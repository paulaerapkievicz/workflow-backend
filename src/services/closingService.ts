import { Op } from 'sequelize'
import { sequelize } from '../database'
import { Invoice } from '../models/Invoice'
import { Job } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { Category } from '../models/Category'
import { Freelancer } from '../models/Freelancer'
import { Agency } from '../models/Agency'
import { Supermarket } from '../models/Supermarket'
import { monthRange, round2 } from '../helpers/time'

const monthlyIncludes = [
  { model: Supermarket, as: 'invoiceSupermarket' },
  { model: Agency, as: 'invoiceAgency' },
  {
    model: Job,
    as: 'invoiceJobs',
    include: [
      { model: Category, as: 'jobCategory' },
      { model: Freelancer, as: 'assignedFreelancer' },
    ],
  },
]

export const closingService = {
  async findById(id: string) {
    return Invoice.findByPk(id, { include: monthlyIncludes })
  },

  async listForAgency(agencyId: string) {
    return Invoice.findAll({
      where: { agencyId, type: 'monthly' },
      include: monthlyIncludes,
      order: [['referenceMonth', 'DESC']],
    })
  },

  async listForSupermarket(supermarketId: string) {
    return Invoice.findAll({
      where: { supermarketId, type: 'monthly' },
      include: monthlyIncludes,
      order: [['referenceMonth', 'DESC']],
    })
  },

  /** Prévia: vagas concluídas ainda não faturadas da rede da agência para um supermercado no mês. */
  async previewMonth(agencyId: string, supermarketId: string, referenceMonth: string) {
    const { start, end } = monthRange(referenceMonth)
    const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id'] })
    const fIds = freelancers.map((f) => f.id)
    if (!fIds.length) return { jobs: [], totals: emptyTotals(referenceMonth) }

    const jobs = await Job.findAll({
      where: {
        supermarketId,
        status: 'completed',
        monthlyInvoiceId: null,
        freelancerId: { [Op.in]: fIds },
        completedAt: { [Op.gte]: start, [Op.lt]: end },
      },
      include: [
        { model: Category, as: 'jobCategory' },
        { model: Freelancer, as: 'assignedFreelancer' },
        { model: JobShift, as: 'shifts' },
      ],
      order: [['completedAt', 'ASC']],
    })
    return { jobs, totals: aggregate(jobs, referenceMonth) }
  },

  async closeMonth(agencyId: string, supermarketId: string, referenceMonth: string) {
    const supermarket = await Supermarket.findByPk(supermarketId)
    if (!supermarket) throw new Error('Supermercado inválido.')
    const { start, end } = monthRange(referenceMonth)

    const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id'] })
    const fIds = freelancers.map((f) => f.id)
    if (!fIds.length) throw new Error('Sua agência não tem freelancers.')

    return sequelize.transaction(async (t) => {
      const jobs = await Job.findAll({
        where: {
          supermarketId,
          status: 'completed',
          monthlyInvoiceId: null,
          freelancerId: { [Op.in]: fIds },
          completedAt: { [Op.gte]: start, [Op.lt]: end },
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      })
      if (!jobs.length) throw new Error('Nenhuma vaga concluída neste período para fechar.')

      const totalAmount = round2(jobs.reduce((acc, j) => acc + Number(j.grossAmount ?? 0), 0))
      const contractedMinutes = jobs.reduce((acc, j) => acc + (j.contractedMinutes ?? 0), 0)
      const workedMinutes = jobs.reduce((acc, j) => acc + (j.workedMinutes ?? 0), 0)

      const invoice = await Invoice.create(
        {
          supermarketId,
          agencyId,
          type: 'monthly',
          referenceMonth,
          periodStart: start,
          periodEnd: end,
          totalJobs: jobs.length,
          contractedMinutes,
          workedMinutes,
          totalAmount,
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

function emptyTotals(referenceMonth: string) {
  return { referenceMonth, totalJobs: 0, contractedMinutes: 0, workedMinutes: 0, totalAmount: 0 }
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
