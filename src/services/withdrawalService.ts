import { sequelize } from '../database'
import {
  Withdrawal, BeneficiaryType, WithdrawalStatus, WITHDRAWAL_STATUSES, PixKeyType, PIX_KEY_TYPES,
} from '../models/Withdrawal'
import { Freelancer } from '../models/Freelancer'
import { Agency } from '../models/Agency'
import { AgencyMember } from '../models/AgencyMember'
import { User, UserInstance } from '../models/User'
import { profileService } from './profileService'

interface Beneficiary {
  type: BeneficiaryType
  id: string
  balance: number
}

async function resolveBeneficiary(user: UserInstance): Promise<Beneficiary> {
  if (user.role === 'freelancer') {
    const f = await profileService.freelancerForUser(user)
    if (!f) throw new Error('Perfil de freelancer não encontrado.')
    return { type: 'freelancer', id: f.id, balance: Number(f.availableBalance) }
  }
  if (user.role === 'agency') {
    const agencyId = await profileService.agencyIdForUser(user)
    const a = agencyId ? await Agency.findByPk(agencyId) : null
    if (!a) throw new Error('Perfil de agência não encontrado.')
    return { type: 'agency', id: a.id, balance: Number(a.availableBalance) }
  }
  if (user.role === 'leader') {
    const m = await AgencyMember.findOne({ where: { userId: user.id, active: true } })
    if (!m) throw new Error('Perfil de líder não encontrado ou inativo.')
    return { type: 'leader', id: m.id, balance: Number(m.availableBalance) }
  }
  throw new Error('Apenas colaboradores, agências e líderes podem solicitar saque.')
}

async function adjustBalance(
  type: BeneficiaryType,
  id: string,
  direction: 'increment' | 'decrement',
  amount: number,
  t: unknown
) {
  const options = { by: amount, transaction: t as never }
  const model = type === 'agency' ? Agency : type === 'leader' ? AgencyMember : Freelancer
  const row: any = await (model as any).findByPk(id, { transaction: t as never })
  if (row) await row[direction]('availableBalance', options)
}

const creditBalance = (type: BeneficiaryType, id: string, amount: number, t: unknown) =>
  adjustBalance(type, id, 'increment', amount, t)

const debitBalance = (type: BeneficiaryType, id: string, amount: number, t: unknown) =>
  adjustBalance(type, id, 'decrement', amount, t)

export const withdrawalService = {
  async request(
    user: UserInstance,
    rawAmount: number,
    pix: { key?: string | null; keyType?: string | null } = {}
  ) {
    const amount = Number(rawAmount)
    if (!(amount > 0)) throw new Error('Informe um valor de saque válido.')

    const pixKey = pix.key?.trim() || null
    if (!pixKey) throw new Error('Informe a chave Pix para receber o saque.')
    const pixKeyType = pix.keyType?.trim() || null
    if (pixKeyType && !PIX_KEY_TYPES.includes(pixKeyType as PixKeyType)) {
      throw new Error('Tipo de chave Pix inválido.')
    }

    const beneficiary = await resolveBeneficiary(user)
    if (amount > beneficiary.balance) throw new Error('Valor solicitado maior que o saldo disponível.')

    return sequelize.transaction(async (t) => {
      await debitBalance(beneficiary.type, beneficiary.id, amount, t)
      return Withdrawal.create(
        {
          beneficiaryType: beneficiary.type,
          beneficiaryId: beneficiary.id,
          amount,
          status: 'requested',
          pixKey,
          pixKeyType: pixKeyType as PixKeyType | null,
          requestedAt: new Date(),
        },
        { transaction: t }
      )
    })
  },

  async listForUser(user: UserInstance) {
    const beneficiary = await resolveBeneficiary(user)
    return Withdrawal.findAll({
      where: { beneficiaryType: beneficiary.type, beneficiaryId: beneficiary.id },
      order: [['requestedAt', 'DESC']],
    })
  },

  /** Admin: todos os saques (opcionalmente por status) com o nome do beneficiário para a baixa manual. */
  async listAll(status?: string) {
    const where = status && WITHDRAWAL_STATUSES.includes(status as WithdrawalStatus) ? { status } : {}
    const rows = await Withdrawal.findAll({ where, order: [['requestedAt', 'DESC']] })
    const byType: Record<BeneficiaryType, string[]> = { freelancer: [], agency: [], leader: [] }
    rows.forEach((w) => byType[w.beneficiaryType]?.push(w.beneficiaryId))
    const [freelancers, agencies, members] = await Promise.all([
      byType.freelancer.length ? Freelancer.findAll({ where: { id: byType.freelancer }, attributes: ['id', 'name'] }) : [],
      byType.agency.length ? Agency.findAll({ where: { id: byType.agency }, attributes: ['id', 'name'] }) : [],
      byType.leader.length ? AgencyMember.findAll({ where: { id: byType.leader }, attributes: ['id', 'userId'] }) : [],
    ])
    const memberUsers = members.length
      ? await User.findAll({ where: { id: members.map((m) => m.userId) }, attributes: ['id', 'name'] })
      : []
    const nameFor = (w: (typeof rows)[number]): string | null => {
      if (w.beneficiaryType === 'freelancer') return freelancers.find((f) => f.id === w.beneficiaryId)?.name ?? null
      if (w.beneficiaryType === 'agency') return agencies.find((a) => a.id === w.beneficiaryId)?.name ?? null
      const m = members.find((x) => x.id === w.beneficiaryId)
      return m ? memberUsers.find((u) => u.id === m.userId)?.name ?? null : null
    }
    return rows.map((w) => ({ ...w.toJSON(), beneficiaryName: nameFor(w) }))
  },

  async process(id: string, status: WithdrawalStatus) {
    if (!['paid', 'rejected'].includes(status)) throw new Error('Status inválido.')
    const withdrawal = await Withdrawal.findByPk(id)
    if (!withdrawal) throw new Error('Saque não encontrado.')
    if (withdrawal.status !== 'requested') throw new Error('Este saque já foi processado.')

    return sequelize.transaction(async (t) => {
      if (status === 'rejected') {
        await creditBalance(withdrawal.beneficiaryType, withdrawal.beneficiaryId, Number(withdrawal.amount), t)
      }
      await withdrawal.update({ status, processedAt: new Date() }, { transaction: t })
      return withdrawal
    })
  },
}
