import bcrypt from 'bcrypt'
import { Op } from 'sequelize'
import { sequelize } from '../database'
import { User } from '../models/User'
import { Agency } from '../models/Agency'
import { Branch } from '../models/Branch'
import { Freelancer } from '../models/Freelancer'
import { Supermarket } from '../models/Supermarket'
import { AgencyMember, AGENCY_MEMBER_PAY_TYPES, AgencyMemberPayType } from '../models/AgencyMember'
import { AgencyMemberFreelancer } from '../models/AgencyMemberFreelancer'
import { AgencyMemberBranch } from '../models/AgencyMemberBranch'
import { AgencyMemberPayment } from '../models/AgencyMemberPayment'
import { leaderJobCreditService } from './leaderJobCreditService'

function parsePay(payType: unknown, payAmount: unknown): { payType: AgencyMemberPayType; payAmount: number } {
  if (!payType || !AGENCY_MEMBER_PAY_TYPES.includes(payType as AgencyMemberPayType)) {
    throw new Error('Escolha a forma de pagamento do líder (hora, diária, mensal ou por colaborador que trabalhou).')
  }
  const amount = Number(payAmount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Informe o valor de pagamento do líder (maior que zero).')
  }
  return { payType: payType as AgencyMemberPayType, payAmount: amount }
}

async function serialize(member: AgencyMember & { id: string }) {
  const [user, freelancers, branches, payments, jobCredits] = await Promise.all([
    User.findByPk(member.userId, { attributes: ['id', 'name', 'email', 'phone'] }),
    AgencyMemberFreelancer.findAll({ where: { agencyMemberId: member.id }, attributes: ['freelancerId'] }),
    AgencyMemberBranch.findAll({ where: { agencyMemberId: member.id }, attributes: ['branchId'] }),
    AgencyMemberPayment.findAll({
      where: { agencyMemberId: member.id },
      order: [['createdAt', 'DESC']],
    }),
    leaderJobCreditService.listForMember(member.id),
  ])
  const creditsReleasedTotal = jobCredits
    .filter((c) => c.status === 'released')
    .reduce((acc, c) => acc + c.amount, 0)
  const creditsPendingTotal = jobCredits
    .filter((c) => c.status === 'pending')
    .reduce((acc, c) => acc + c.amount, 0)
  return {
    id: member.id,
    agencyId: member.agencyId,
    userId: member.userId,
    name: user?.name ?? null,
    email: user?.email ?? null,
    phone: user?.phone ?? null,
    active: member.active,
    payType: member.payType ?? null,
    payAmount: member.payAmount != null ? Number(member.payAmount) : null,
    availableBalance: Number(member.availableBalance ?? 0),
    scope: {
      freelancerIds: freelancers.map((f) => f.freelancerId),
      branchIds: branches.map((b) => b.branchId),
    },
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      referenceMonth: p.referenceMonth ?? null,
      note: p.note ?? null,
      createdAt: p.createdAt,
    })),
    jobCredits,
    creditsReleasedTotal: Number(creditsReleasedTotal.toFixed(2)),
    creditsPendingTotal: Number(creditsPendingTotal.toFixed(2)),
  }
}

async function assertScopeBelongsToAgency(agencyId: string, freelancerIds: string[], branchIds: string[]) {
  if (freelancerIds.length) {
    const count = await Freelancer.count({ where: { id: { [Op.in]: freelancerIds }, agencyId } })
    if (count !== new Set(freelancerIds).size) {
      throw new Error('Algum colaborador do escopo não pertence à sua agência.')
    }
  }
  if (branchIds.length) {
    const branches = await Branch.findAll({
      where: { id: { [Op.in]: branchIds } },
      include: [{ model: Supermarket, as: 'parentSupermarket', attributes: ['agencyId'] }],
    })
    if (branches.length !== new Set(branchIds).size) throw new Error('Filial do escopo não encontrada.')
    if (branches.some((b) => (b as any).parentSupermarket?.agencyId !== agencyId)) {
      throw new Error('Alguma filial do escopo não é de um cliente da sua agência.')
    }
  }
}

async function replaceScope(
  agencyMemberId: string,
  freelancerIds: string[],
  branchIds: string[],
  t: import('sequelize').Transaction
) {
  await AgencyMemberFreelancer.destroy({ where: { agencyMemberId }, transaction: t })
  await AgencyMemberBranch.destroy({ where: { agencyMemberId }, transaction: t })
  for (const freelancerId of [...new Set(freelancerIds)]) {
    await AgencyMemberFreelancer.create({ agencyMemberId, freelancerId }, { transaction: t })
  }
  for (const branchId of [...new Set(branchIds)]) {
    await AgencyMemberBranch.create({ agencyMemberId, branchId }, { transaction: t })
  }
}

export const agencyMemberService = {
  async list(agencyId: string) {
    const members = await AgencyMember.findAll({ where: { agencyId }, order: [['createdAt', 'ASC']] })
    return Promise.all(members.map((m) => serialize(m)))
  },

  async get(id: string, agencyId: string) {
    const member = await AgencyMember.findOne({ where: { id, agencyId } })
    if (!member) throw new Error('Líder não encontrado.')
    return serialize(member)
  },

  /** Cria o líder direto (login + AgencyMember), sem passar por convite. */
  async createDirect(
    agencyId: string,
    data: {
      name?: string
      email?: string
      password?: string
      phone?: string
      payType?: unknown
      payAmount?: unknown
      freelancerIds?: string[]
      branchIds?: string[]
    }
  ) {
    const { name, email, password } = data
    if (!name || !email || !password) {
      throw new Error('Informe nome, e-mail e senha do líder.')
    }
    if (String(password).length < 6) throw new Error('A senha do líder precisa ter ao menos 6 caracteres.')
    const pay = parsePay(data.payType, data.payAmount)
    const exists = await User.findOne({ where: { email } })
    if (exists) throw new Error('Este e-mail já está cadastrado.')

    const freelancerIds = data.freelancerIds ?? []
    const branchIds = data.branchIds ?? []
    await assertScopeBelongsToAgency(agencyId, freelancerIds, branchIds)

    const member = await sequelize.transaction(async (t) => {
      const passwordHash = await bcrypt.hash(String(password), 10)
      const user = await User.create(
        { name, email, passwordHash, role: 'leader', phone: data.phone ?? null },
        { transaction: t }
      )
      const created = await AgencyMember.create(
        { agencyId, userId: user.id, active: true, payType: pay.payType, payAmount: pay.payAmount },
        { transaction: t }
      )
      await replaceScope(created.id, freelancerIds, branchIds, t)
      return created
    })
    return serialize(member)
  },

  async update(
    id: string,
    agencyId: string,
    data: { payType?: unknown; payAmount?: unknown; active?: unknown }
  ) {
    const member = await AgencyMember.findOne({ where: { id, agencyId } })
    if (!member) throw new Error('Líder não encontrado.')
    const patch: Record<string, unknown> = {}
    if (data.payType !== undefined || data.payAmount !== undefined) {
      const pay = parsePay(data.payType ?? member.payType, data.payAmount ?? member.payAmount)
      patch.payType = pay.payType
      patch.payAmount = pay.payAmount
    }
    if (data.active !== undefined) patch.active = data.active === true || data.active === 'true'
    await member.update(patch)
    return serialize(member)
  },

  async setScope(id: string, agencyId: string, freelancerIds: string[], branchIds: string[]) {
    const member = await AgencyMember.findOne({ where: { id, agencyId } })
    if (!member) throw new Error('Líder não encontrado.')
    await assertScopeBelongsToAgency(agencyId, freelancerIds, branchIds)
    await sequelize.transaction((t) => replaceScope(member.id, freelancerIds, branchIds, t))
    return serialize(member)
  },

  async deactivate(id: string, agencyId: string) {
    const member = await AgencyMember.findOne({ where: { id, agencyId } })
    if (!member) throw new Error('Líder não encontrado.')
    await member.update({ active: false })
    return serialize(member)
  },

  /** A agência credita a carteira do líder — debita o saldo da agência. */
  async registerPayment(
    id: string,
    agencyId: string,
    createdBy: string,
    data: { amount?: unknown; referenceMonth?: string | null; note?: string | null }
  ) {
    const member = await AgencyMember.findOne({ where: { id, agencyId } })
    if (!member) throw new Error('Líder não encontrado.')
    const amount = Number(data.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor de pagamento válido.')

    const referenceMonth = data.referenceMonth?.trim() || null
    if (referenceMonth && !/^\d{4}-\d{2}$/.test(referenceMonth)) {
      throw new Error('Mês de referência inválido (use AAAA-MM).')
    }

    const agency = await Agency.findByPk(agencyId)
    if (!agency) throw new Error('Agência não encontrada.')
    if (Number(agency.availableBalance) < amount) {
      throw new Error('Saldo da agência insuficiente para este pagamento.')
    }

    if (referenceMonth) {
      const dup = await AgencyMemberPayment.findOne({ where: { agencyMemberId: member.id, referenceMonth } })
      if (dup) throw new Error(`O pagamento de ${referenceMonth} para este líder já foi lançado.`)
    }

    await sequelize.transaction(async (t) => {
      await agency.decrement('availableBalance', { by: amount, transaction: t })
      await member.increment('availableBalance', { by: amount, transaction: t })
      await AgencyMemberPayment.create(
        { agencyMemberId: member.id, amount, referenceMonth, note: data.note?.trim() || null, createdBy },
        { transaction: t }
      )
    })
    return serialize(await member.reload())
  },

  async walletForUser(userId: string) {
    const member = await AgencyMember.findOne({ where: { userId } })
    if (!member) throw new Error('Líder não encontrado.')
    const [agency, payments, jobCredits] = await Promise.all([
      Agency.findByPk(member.agencyId, { attributes: ['name'] }),
      AgencyMemberPayment.findAll({ where: { agencyMemberId: member.id }, order: [['createdAt', 'DESC']] }),
      leaderJobCreditService.listForMember(member.id),
    ])
    return {
      id: member.id,
      active: member.active,
      agencyName: agency?.name ?? null,
      payType: member.payType ?? null,
      payAmount: member.payAmount != null ? Number(member.payAmount) : null,
      availableBalance: Number(member.availableBalance ?? 0),
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        referenceMonth: p.referenceMonth ?? null,
        note: p.note ?? null,
        createdAt: p.createdAt,
      })),
      jobCredits,
      creditsReleasedTotal: Number(
        jobCredits.filter((c) => c.status === 'released').reduce((acc, c) => acc + c.amount, 0).toFixed(2)
      ),
      creditsPendingTotal: Number(
        jobCredits.filter((c) => c.status === 'pending').reduce((acc, c) => acc + c.amount, 0).toFixed(2)
      ),
    }
  },
}
