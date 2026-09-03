import { Op } from 'sequelize'
import { sequelize } from '../database'
import { Invoice } from '../models/Invoice'
import { Job } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'
import { Freelancer } from '../models/Freelancer'
import { Agency } from '../models/Agency'
import { Supermarket } from '../models/Supermarket'
import { monthRange, round2 } from '../helpers/time'

const monthlyIncludes = [
  { model: Supermarket, as: 'invoiceSupermarket' },
  { model: Agency, as: 'invoiceAgency' },
  { model: Branch, as: 'invoiceBranch' },
  {
    model: Job,
    as: 'invoiceJobs',
    include: [
      { model: Category, as: 'jobCategory' },
      { model: Branch, as: 'jobBranch' },
      { model: Freelancer, as: 'assignedFreelancer' },
    ],
  },
]

function jobWhere(fIds: string[], supermarketId: string, start: Date, end: Date, branchId?: string | null) {
  const where: any = {
    supermarketId,
    status: 'completed',
    // vagas com pagamento retido (hora extra) só entram no fechamento depois de liberadas
    settlementHold: false,
    monthlyInvoiceId: null,
    freelancerId: { [Op.in]: fIds },
    completedAt: { [Op.gte]: start, [Op.lt]: end },
  }
  if (branchId) where.branchId = branchId
  return where
}

export const closingService = {
  async findById(id: string) {
    return Invoice.findByPk(id, { include: monthlyIncludes })
  },

  async listForAgency(agencyId: string) {
    return Invoice.findAll({ where: { agencyId, type: 'monthly' }, include: monthlyIncludes, order: [['referenceMonth', 'DESC']] })
  },

  async listForSupermarket(supermarketId: string) {
    return Invoice.findAll({ where: { supermarketId, type: 'monthly' }, include: monthlyIncludes, order: [['referenceMonth', 'DESC']] })
  },

  /** Prévia: vagas concluídas ainda não faturadas (opcionalmente filtrando por filial). */
  async previewMonth(agencyId: string, supermarketId: string, referenceMonth: string, branchId?: string | null) {
    const { start, end } = monthRange(referenceMonth)
    const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id'] })
    const fIds = freelancers.map((f) => f.id)
    if (!fIds.length) return { jobs: [], totals: aggregate([], referenceMonth) }

    const jobs = await Job.findAll({
      where: jobWhere(fIds, supermarketId, start, end, branchId),
      include: [
        { model: Category, as: 'jobCategory' },
        { model: Branch, as: 'jobBranch' },
        { model: Freelancer, as: 'assignedFreelancer' },
        { model: JobShift, as: 'shifts' },
      ],
      order: [['completedAt', 'ASC']],
    })
    return { jobs, totals: aggregate(jobs, referenceMonth) }
  },

  async closeMonth(
    agencyId: string,
    supermarketId: string,
    referenceMonth: string,
    branchId?: string | null
  ) {
    const supermarket = await Supermarket.findByPk(supermarketId)
    if (!supermarket) throw new Error('Supermercado inválido.')
    if (branchId) {
      const branch = await Branch.findByPk(branchId)
      if (!branch || branch.supermarketId !== supermarketId) throw new Error('Filial inválida para este supermercado.')
    }
    const { start, end } = monthRange(referenceMonth)

    const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id'] })
    const fIds = freelancers.map((f) => f.id)
    if (!fIds.length) throw new Error('Sua agência não tem freelancers.')

    return sequelize.transaction(async (t) => {
      const jobs = await Job.findAll({
        where: jobWhere(fIds, supermarketId, start, end, branchId),
        transaction: t,
        lock: t.LOCK.UPDATE,
      })
      if (!jobs.length) throw new Error('Nenhuma vaga concluída neste período para fechar.')

      const invoice = await Invoice.create(
        {
          supermarketId,
          agencyId,
          branchId: branchId ?? null,
          type: 'monthly',
          referenceMonth,
          periodStart: start,
          periodEnd: end,
          totalJobs: jobs.length,
          contractedMinutes: jobs.reduce((a, j) => a + (j.contractedMinutes ?? 0), 0),
          workedMinutes: jobs.reduce((a, j) => a + (j.workedMinutes ?? 0), 0),
          totalAmount: round2(jobs.reduce((a, j) => a + Number(j.grossAmount ?? 0), 0)),
          status: 'pending',
        },
        { transaction: t }
      )

      await Job.update(
        { monthlyInvoiceId: invoice.id },
        { where: { id: { [Op.in]: jobs.map((j) => j.id) } }, transaction: t }
      )
      return invoice
    }).then((inv) => this.findById(inv.id))
  },
}

function aggregate(jobs: any[], referenceMonth: string) {
  return {
    referenceMonth,
    totalJobs: jobs.length,
    contractedMinutes: jobs.reduce((a, j) => a + (j.contractedMinutes ?? 0), 0),
    workedMinutes: jobs.reduce((a, j) => a + (j.workedMinutes ?? 0), 0),
    totalAmount: round2(jobs.reduce((a, j) => a + Number(j.grossAmount ?? 0), 0)),
  }
}
