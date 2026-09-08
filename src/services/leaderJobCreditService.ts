import { Op, Transaction } from 'sequelize'
import { sequelize } from '../database'
import { Agency } from '../models/Agency'
import { Branch } from '../models/Branch'
import { Freelancer } from '../models/Freelancer'
import { Job } from '../models/Job'
import { User } from '../models/User'
import { AgencyMember } from '../models/AgencyMember'
import { AgencyMemberFreelancer } from '../models/AgencyMemberFreelancer'
import { AgencyMemberBranch } from '../models/AgencyMemberBranch'
import {
  AgencyMemberJobCredit,
  AgencyMemberJobCreditInstance,
  AgencyMemberJobCreditStatus,
} from '../models/AgencyMemberJobCredit'

/**
 * Pagamento do líder pago `por_colaborador`: ele não tem salário fixo — ganha um valor
 * (definido pela agência, editável a qualquer momento) por cada vaga que um colaborador do
 * seu grupo conclui. Quando a conclusão é normal (o próprio colaborador bate o check-out)
 * o crédito entra `released` na carteira do líder na hora; quando houve desistência, falta,
 * troca ou checkout forçado, entra `pending` para a agência decidir se paga.
 */

const PER_COLLABORATOR: string = 'por_colaborador'

function coversJob(
  frIds: string[],
  brIds: string[],
  job: { freelancerId?: string | null; branchId: string }
): boolean {
  const coversFreelancer = frIds.length === 0 || (!!job.freelancerId && frIds.includes(job.freelancerId))
  const coversBranch = brIds.length === 0 || brIds.includes(job.branchId)
  return coversFreelancer && coversBranch
}

async function serialize(credit: AgencyMemberJobCreditInstance & { id: string }) {
  const [member, job] = await Promise.all([
    AgencyMember.findByPk(credit.agencyMemberId),
    Job.findByPk(credit.jobId, {
      include: [{ model: Branch, as: 'jobBranch', attributes: ['name'] }],
    }),
  ])
  const [leaderUser, freelancer] = await Promise.all([
    member ? User.findByPk(member.userId, { attributes: ['name'] }) : null,
    credit.freelancerId ? Freelancer.findByPk(credit.freelancerId, { attributes: ['name'] }) : null,
  ])
  return {
    id: credit.id,
    agencyMemberId: credit.agencyMemberId,
    leaderName: leaderUser?.name ?? null,
    jobId: credit.jobId,
    jobTitle: job?.title ?? null,
    branchName: (job as any)?.jobBranch?.name ?? null,
    freelancerId: credit.freelancerId ?? null,
    freelancerName: freelancer?.name ?? null,
    amount: Number(credit.amount),
    status: credit.status,
    note: credit.note ?? null,
    releasedAt: credit.releasedAt ?? null,
    createdAt: credit.createdAt,
  }
}

export const leaderJobCreditService = {
  /**
   * Lança os créditos dos líderes `por_colaborador` cuja área cobre a vaga recém-liquidada.
   * Roda dentro da transação de `paymentService.settleForJob`. Idempotente por (líder, vaga).
   */
  async accrueForSettledJob(
    job: { id: string; freelancerId?: string | null; branchId: string },
    agencyId: string,
    status: AgencyMemberJobCreditStatus,
    t: Transaction
  ) {
    if (!job.freelancerId) return
    const members = await AgencyMember.findAll({
      where: { agencyId, active: true, payType: PER_COLLABORATOR },
      transaction: t,
    })
    if (!members.length) return

    const now = new Date()
    for (const member of members) {
      const amount = Number(member.payAmount ?? 0)
      if (!(amount > 0)) continue

      const [scopeFr, scopeBr] = await Promise.all([
        AgencyMemberFreelancer.findAll({
          where: { agencyMemberId: member.id },
          attributes: ['freelancerId'],
          transaction: t,
        }),
        AgencyMemberBranch.findAll({
          where: { agencyMemberId: member.id },
          attributes: ['branchId'],
          transaction: t,
        }),
      ])
      if (!coversJob(scopeFr.map((x) => x.freelancerId), scopeBr.map((x) => x.branchId), job)) continue

      const existing = await AgencyMemberJobCredit.findOne({
        where: { agencyMemberId: member.id, jobId: job.id },
        transaction: t,
      })
      if (existing) continue

      await AgencyMemberJobCredit.create(
        {
          agencyMemberId: member.id,
          jobId: job.id,
          freelancerId: job.freelancerId,
          amount,
          status,
          releasedAt: status === 'released' ? now : null,
        },
        { transaction: t }
      )
      if (status === 'released') {
        await Agency.decrement('availableBalance', { by: amount, where: { id: agencyId }, transaction: t })
        await AgencyMember.increment('availableBalance', { by: amount, where: { id: member.id }, transaction: t })
      }
    }
  },

  /** Créditos por colaborador da rede da agência (todos, ou filtrados por status). */
  async listForAgency(agencyId: string, status?: AgencyMemberJobCreditStatus) {
    const members = await AgencyMember.findAll({ where: { agencyId }, attributes: ['id'] })
    const memberIds = members.map((m) => m.id)
    if (!memberIds.length) return []
    const where: any = { agencyMemberId: { [Op.in]: memberIds } }
    if (status) where.status = status
    const credits = await AgencyMemberJobCredit.findAll({ where, order: [['createdAt', 'DESC']] })
    return Promise.all(credits.map((c) => serialize(c)))
  },

  async countPendingForAgency(agencyId: string) {
    const members = await AgencyMember.findAll({ where: { agencyId }, attributes: ['id'] })
    const memberIds = members.map((m) => m.id)
    if (!memberIds.length) return 0
    return AgencyMemberJobCredit.count({
      where: { agencyMemberId: { [Op.in]: memberIds }, status: 'pending' },
    })
  },

  async listForMember(agencyMemberId: string) {
    const credits = await AgencyMemberJobCredit.findAll({
      where: { agencyMemberId },
      order: [['createdAt', 'DESC']],
    })
    return Promise.all(credits.map((c) => serialize(c)))
  },

  async findOwned(id: string, agencyId: string) {
    const credit = await AgencyMemberJobCredit.findByPk(id)
    if (!credit) throw new Error('Crédito não encontrado.')
    const member = await AgencyMember.findByPk(credit.agencyMemberId)
    if (!member || member.agencyId !== agencyId) throw new Error('Este crédito não é da sua agência.')
    return { credit, member }
  },

  /** A agência libera um crédito que estava pendente (ou reabre um cancelado): credita o líder, debita a agência. */
  async release(id: string, agencyId: string) {
    const { credit, member } = await this.findOwned(id, agencyId)
    if (credit.status === 'released') throw new Error('Este crédito já foi liberado.')
    const amount = Number(credit.amount)
    await sequelize.transaction(async (t) => {
      await credit.update({ status: 'released', releasedAt: new Date(), note: null }, { transaction: t })
      await Agency.decrement('availableBalance', { by: amount, where: { id: agencyId }, transaction: t })
      await AgencyMember.increment('availableBalance', { by: amount, where: { id: member.id }, transaction: t })
    })
    return serialize(await credit.reload())
  },

  /** A agência decide não pagar. Se já estava liberado, estorna a carteira do líder e o saldo da agência. */
  async cancel(id: string, agencyId: string, note?: string | null) {
    const { credit, member } = await this.findOwned(id, agencyId)
    if (credit.status === 'canceled') throw new Error('Este crédito já foi cancelado.')
    const wasReleased = credit.status === 'released'
    const amount = Number(credit.amount)
    await sequelize.transaction(async (t) => {
      await credit.update(
        { status: 'canceled', releasedAt: null, note: note?.trim() || null },
        { transaction: t }
      )
      if (wasReleased) {
        await Agency.increment('availableBalance', { by: amount, where: { id: agencyId }, transaction: t })
        await AgencyMember.decrement('availableBalance', { by: amount, where: { id: member.id }, transaction: t })
      }
    })
    return serialize(await credit.reload())
  },
}
