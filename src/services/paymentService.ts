import { Op } from 'sequelize'
import { sequelize } from '../database'
import { Payment, PaymentInstance } from '../models/Payment'
import { Job, JobInstance } from '../models/Job'
import { Branch } from '../models/Branch'
import { Category } from '../models/Category'
import { Freelancer } from '../models/Freelancer'
import { Agency } from '../models/Agency'
import { Invoice } from '../models/Invoice'
import { JobShift } from '../models/JobShift'
import { Role } from '../middlewares/auth'
import { agencyRateService } from './agencyRateService'
import { round2 } from '../helpers/time'

const paymentIncludes = [
  {
    model: Job,
    as: 'paymentJob',
    include: [
      { model: Branch, as: 'jobBranch' },
      { model: Category, as: 'jobCategory' },
    ],
  },
  { model: Freelancer, as: 'paymentFreelancer' },
]

export const paymentService = {
  async findAll() {
    return Payment.findAll({ include: paymentIncludes, order: [['createdAt', 'DESC']] })
  },

  async findById(id: string) {
    return Payment.findByPk(id, { include: paymentIncludes })
  },

  async findByJob(jobId: string) {
    return Payment.findOne({ where: { jobId }, include: paymentIncludes })
  },

  async listForFreelancer(freelancerId: string) {
    return Payment.findAll({ where: { freelancerId }, include: paymentIncludes, order: [['createdAt', 'DESC']] })
  },

  async listForAgency(agencyId: string) {
    const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id'] })
    const ids = freelancers.map((f) => f.id)
    if (!ids.length) return []
    return Payment.findAll({
      where: { freelancerId: { [Op.in]: ids } },
      include: paymentIncludes,
      order: [['createdAt', 'DESC']],
    })
  },

  async listForSupermarket(supermarketId: string) {
    const jobs = await Job.findAll({ where: { supermarketId }, attributes: ['id'] })
    const ids = jobs.map((j) => j.id)
    if (!ids.length) return []
    return Payment.findAll({
      where: { jobId: { [Op.in]: ids } },
      include: paymentIncludes,
      order: [['createdAt', 'DESC']],
    })
  },

  // Carteira opaca: cada papel só enxerga os valores que lhe dizem respeito.
  serializeForRole(payment: PaymentInstance, role: Role) {
    const json: any = payment.toJSON()
    if (role === 'freelancer') {
      delete json.grossAmount
      delete json.agencyAmount
      delete json.amount
    } else if (role === 'supermarket') {
      delete json.freelancerAmount
      delete json.agencyAmount
    }
    return json
  },

  // Liberação automática no check-out: valor = R$/hora da agência × horas trabalhadas.
  // Credita as duas carteiras na hora; a fatura ao supermercado sai no fechamento mensal.
  async settleForJob(job: JobInstance) {
    const existing = await Payment.findOne({ where: { jobId: job.id } })
    if (existing) return existing

    if (!job.freelancerId) throw new Error('Vaga sem freelancer atribuído.')
    const freelancer = await Freelancer.findByPk(job.freelancerId)
    if (!freelancer) throw new Error('Freelancer não encontrado.')
    if (!freelancer.agencyId) throw new Error('Freelancer sem agência: não é possível precificar a vaga.')
    const agency = await Agency.findByPk(freelancer.agencyId)
    if (!agency) throw new Error('Agência não encontrada.')

    const rate = await agencyRateService.activeRate(agency.id, job.categoryId, job.branchId)
    if (!rate) throw new Error('Agência sem valor/hora cadastrado para esta função nesta loja.')

    let workedMinutes = job.workedMinutes ?? 0
    if (!workedMinutes) {
      const shifts = await JobShift.findAll({ where: { jobId: job.id } })
      workedMinutes = shifts.reduce((acc, s) => acc + (s.workedMinutes ?? 0), 0)
    }

    const gross = round2((Number(rate.hourlyRate) * workedMinutes) / 60)
    const pct = Number(agency.commissionPercentage) || 0
    const agencyAmount = round2((gross * pct) / 100)
    const freelancerAmount = round2(gross - agencyAmount)
    const now = new Date()

    return sequelize.transaction(async (t) => {
      const payment = await Payment.create(
        {
          jobId: job.id,
          freelancerId: freelancer.id,
          amount: gross,
          grossAmount: gross,
          agencyAmount,
          freelancerAmount,
          status: 'settled',
          paidAt: now,
          releasedAt: now,
        },
        { transaction: t }
      )

      await job.update({ grossAmount: gross, paymentAmount: gross, workedMinutes }, { transaction: t })
      await freelancer.increment('availableBalance', { by: freelancerAmount, transaction: t })
      await agency.increment('availableBalance', { by: agencyAmount, transaction: t })

      return payment
    })
  },

  // Supermercado quita a fatura com a agência (dinheiro externo à carteira).
  async invoicePay(invoiceId: string, supermarketId: string) {
    const invoice = await Invoice.findByPk(invoiceId)
    if (!invoice) throw new Error('Fatura não encontrada.')
    if (invoice.supermarketId !== supermarketId) throw new Error('Fatura não pertence ao seu supermercado.')
    if (invoice.status !== 'pending') throw new Error('Esta fatura não está pendente.')
    await invoice.update({ status: 'paid' })
    return invoice
  },

  async listInvoicesForSupermarket(supermarketId: string) {
    return Invoice.findAll({
      where: { supermarketId },
      include: [{ model: Job, as: 'invoiceJob' }],
      order: [['createdAt', 'DESC']],
    })
  },

  async cancel(id: string) {
    const payment = await Payment.findByPk(id)
    if (!payment) throw new Error('Pagamento não encontrado.')
    await payment.update({ status: 'canceled' })
    return payment
  },
}
