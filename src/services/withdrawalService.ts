import { sequelize } from '../database'
import { Withdrawal, BeneficiaryType, WithdrawalStatus } from '../models/Withdrawal'
import { Freelancer } from '../models/Freelancer'
import { Agency } from '../models/Agency'
import { UserInstance } from '../models/User'
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
  throw new Error('Apenas freelancers e agências podem solicitar saque.')
}

async function creditBalance(type: BeneficiaryType, id: string, amount: number, t: unknown) {
  const options = { by: amount, transaction: t as never }
  if (type === 'agency') {
    const a = await Agency.findByPk(id, { transaction: t as never })
    if (a) await a.increment('availableBalance', options)
  } else {
    const f = await Freelancer.findByPk(id, { transaction: t as never })
    if (f) await f.increment('availableBalance', options)
  }
}

async function debitBalance(type: BeneficiaryType, id: string, amount: number, t: unknown) {
  const options = { by: amount, transaction: t as never }
  if (type === 'agency') {
    const a = await Agency.findByPk(id, { transaction: t as never })
    if (a) await a.decrement('availableBalance', options)
  } else {
    const f = await Freelancer.findByPk(id, { transaction: t as never })
    if (f) await f.decrement('availableBalance', options)
  }
}

export const withdrawalService = {
  async request(user: UserInstance, rawAmount: number) {
    const amount = Number(rawAmount)
    if (!(amount > 0)) throw new Error('Informe um valor de saque válido.')

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
