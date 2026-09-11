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
import { supermarketRateService } from './supermarketRateService'
import { freelancerService } from './freelancerService'
import { paymentGatewayService } from './paymentGatewayService'
import { invoiceAdjustmentService } from './invoiceAdjustmentService'
import { leaderJobCreditService } from './leaderJobCreditService'
import { AgencyMemberJobCreditStatus } from '../models/AgencyMemberJobCredit'
import { Supermarket } from '../models/Supermarket'
import { User } from '../models/User'
import { round2 } from '../helpers/time'

/** `external_reference` das faturas no gateway — separa do uniforme e de outros domínios. */
const INVOICE_REF_PREFIX = 'invoice:'

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

  // Liquidação da vaga: o supermercado paga (R$/hora do supermercado por função) e o
  // colaborador recebe (R$/hora do colaborador por função), ambos proporcionais às horas
  // trabalhadas. A diferença fica com a agência. Credita as carteiras na hora; a fatura ao
  // supermercado sai no fechamento mensal.
  async settleForJob(
    job: JobInstance,
    opts: { leaderCreditStatus?: AgencyMemberJobCreditStatus } = {}
  ) {
    // Como o líder pago `por_colaborador` ganha por vaga concluída pelo colaborador: quando é o
    // próprio colaborador que fecha o ponto, o crédito entra liberado; quando a conclusão veio
    // de uma intervenção (desistência, falta, troca, checkout forçado) fica pendente de decisão.
    const leaderCreditStatus: AgencyMemberJobCreditStatus = opts.leaderCreditStatus ?? 'released'
    const existing = await Payment.findOne({ where: { jobId: job.id } })
    if (existing) {
      // A vaga já foi liquidada antes, mas a trava de hora extra pode ter ficado
      // pendurada (ex.: pagamento criado por outro caminho) — solta a trava para
      // a vaga não ficar presa em "aguardando liberação".
      if (job.settlementHold) {
        await job.update({
          settlementHold: false,
          settlementApprovedAt: job.settlementApprovedAt ?? new Date(),
        })
      }
      return existing
    }

    if (!job.freelancerId) throw new Error('Vaga sem freelancer atribuído.')
    const freelancer = await Freelancer.findByPk(job.freelancerId)
    if (!freelancer) throw new Error('Freelancer não encontrado.')
    if (!freelancer.agencyId) throw new Error('Freelancer sem agência: não é possível liquidar a vaga.')
    const agency = await Agency.findByPk(freelancer.agencyId)
    if (!agency) throw new Error('Agência não encontrada.')

    const category = await Category.findByPk(job.categoryId)
    const funcao = category?.name ? `"${category.name}"` : 'desta vaga'

    const supermarketRate = await supermarketRateService.activeRate(
      job.supermarketId,
      job.categoryId,
      job.branchId
    )
    if (!supermarketRate) {
      throw new Error(
        `Não dá para liquidar o pagamento: falta o valor/hora que o supermercado paga pela função ${funcao} nesta loja. ` +
          'Configure em Supermercados → "Valores/hora" e libere o pagamento de novo.'
      )
    }
    const freelancerRate = await freelancerService.categoryRate(freelancer.id, job.categoryId)
    if (freelancerRate == null) {
      throw new Error(
        `Não dá para liquidar o pagamento: falta o valor/hora do colaborador para a função ${funcao}. ` +
          'Configure em Colaboradores (valor/hora por função) e libere o pagamento de novo.'
      )
    }

    let workedMinutes = job.workedMinutes ?? 0
    if (!workedMinutes) {
      const shifts = await JobShift.findAll({ where: { jobId: job.id } })
      workedMinutes = shifts.reduce((acc, s) => acc + (s.workedMinutes ?? 0), 0)
    }

    const supermarketAmount = round2((Number(supermarketRate.hourlyRate) * workedMinutes) / 60)
    const freelancerAmount = round2((freelancerRate * workedMinutes) / 60)
    const agencyAmount = round2(supermarketAmount - freelancerAmount)
    const now = new Date()

    return sequelize.transaction(async (t) => {
      const payment = await Payment.create(
        {
          jobId: job.id,
          freelancerId: freelancer.id,
          amount: supermarketAmount,
          grossAmount: supermarketAmount,
          agencyAmount,
          freelancerAmount,
          status: 'settled',
          paidAt: now,
          releasedAt: now,
        },
        { transaction: t }
      )

      await job.update(
        {
          grossAmount: supermarketAmount,
          paymentAmount: supermarketAmount,
          workedMinutes,
          settlementHold: false,
          settlementApprovedAt: job.settlementApprovedAt ?? now,
        },
        { transaction: t }
      )
      await freelancer.increment('availableBalance', { by: freelancerAmount, transaction: t })
      await agency.increment('availableBalance', { by: agencyAmount, transaction: t })

      await leaderJobCreditService.accrueForSettledJob(job, agency.id, leaderCreditStatus, t)

      return payment
    })
  },

  /**
   * Re-liquida uma vaga já paga depois que a agência corrigiu o ponto (`job.workedMinutes`
   * mudou). Recalcula o `Payment` pelas mesmas tarifas e ajusta os saldos do colaborador e
   * da agência pela diferença (delta pode ser negativo). Numa transação.
   */
  async resettleForJob(job: JobInstance) {
    const payment = await Payment.findOne({ where: { jobId: job.id } })
    if (!payment) throw new Error('Esta vaga ainda não foi liquidada — não há o que reajustar.')
    if (payment.status !== 'settled') throw new Error('Pagamento não está liquidado.')

    const freelancer = await Freelancer.findByPk(job.freelancerId as string)
    if (!freelancer || !freelancer.agencyId) throw new Error('Colaborador/agência da vaga não encontrados.')
    const agency = await Agency.findByPk(freelancer.agencyId)
    if (!agency) throw new Error('Agência não encontrada.')

    const supermarketRate = await supermarketRateService.activeRate(job.supermarketId, job.categoryId, job.branchId)
    const freelancerRate = await freelancerService.categoryRate(freelancer.id, job.categoryId)
    if (!supermarketRate || freelancerRate == null) {
      throw new Error('Faltam as tarifas (supermercado/colaborador) da função — não dá para reajustar o pagamento.')
    }

    const workedMinutes = job.workedMinutes ?? 0
    const newSupermarketAmount = round2((Number(supermarketRate.hourlyRate) * workedMinutes) / 60)
    const newFreelancerAmount = round2((freelancerRate * workedMinutes) / 60)
    const newAgencyAmount = round2(newSupermarketAmount - newFreelancerAmount)

    const deltaFreelancer = round2(newFreelancerAmount - Number(payment.freelancerAmount ?? 0))
    const deltaAgency = round2(newAgencyAmount - Number(payment.agencyAmount ?? 0))

    return sequelize.transaction(async (t) => {
      await payment.update(
        {
          amount: newSupermarketAmount,
          grossAmount: newSupermarketAmount,
          agencyAmount: newAgencyAmount,
          freelancerAmount: newFreelancerAmount,
        },
        { transaction: t }
      )
      await job.update(
        { grossAmount: newSupermarketAmount, paymentAmount: newSupermarketAmount },
        { transaction: t }
      )
      if (deltaFreelancer !== 0) {
        await freelancer.increment('availableBalance', { by: deltaFreelancer, transaction: t })
      }
      if (deltaAgency !== 0) {
        await agency.increment('availableBalance', { by: deltaAgency, transaction: t })
      }
      return payment
    })
  },

  // Supermercado quita a fatura com a agência (dinheiro externo à carteira).
  /**
   * Supermercado paga o fechamento mensal. Com o gateway configurado, gera o link de
   * pagamento real (Checkout Pro) e a fatura só vira `paid` quando o Mercado Pago confirma
   * (webhook ou `syncInvoicePayment`). Sem gateway (dev), mantém a baixa manual direta.
   */
  async invoicePay(invoiceId: string, supermarketId: string) {
    const invoice = await Invoice.findByPk(invoiceId)
    if (!invoice) throw new Error('Fatura não encontrada.')
    if (invoice.supermarketId !== supermarketId) throw new Error('Fatura não pertence ao seu supermercado.')
    if (invoice.status !== 'pending') throw new Error('Esta fatura não está pendente.')

    const market = await Supermarket.findByPk(supermarketId)
    if (!market) throw new Error('Supermercado não encontrado.')
    const agency = await Agency.findByPk(market.agencyId)
    if (!agency?.appPaymentEnabledForSupermarkets || !market.appPaymentEnabled) {
      throw new Error(
        'O pagamento da fatura pelo app não está habilitado pela sua agência. Combine o pagamento com ela e aguarde a confirmação manual.'
      )
    }

    // Contestações pendentes precisam ser resolvidas pela agência antes do pagamento do líquido.
    await invoiceAdjustmentService.assertNoPending(invoice.id)
    const amountToPay = invoiceAdjustmentService.invoiceNetAmount(invoice)

    if (!paymentGatewayService.configured) {
      await invoice.update({ status: 'paid', paidAt: new Date() })
      return invoice.reload()
    }

    const owner = market.ownerId ? await User.findByPk(market.ownerId) : null
    const checkout = await paymentGatewayService.createCheckout({
      reference: `${INVOICE_REF_PREFIX}${invoice.id}`,
      title: `Fechamento mensal ${invoice.referenceMonth ?? ''}`.trim(),
      amount: amountToPay,
      buyerEmail: owner?.email,
      returnPath: '/supermarket/payments',
      returnKey: 'fatura',
    })
    await invoice.update({
      paymentProvider: 'mercadopago',
      paymentRef: checkout.preferenceId,
      paymentUrl: checkout.checkoutUrl,
    })
    return invoice.reload()
  },

  /** Confirma o pagamento da fatura consultando o Mercado Pago sob demanda (sem webhook público). */
  async syncInvoicePayment(invoiceId: string, supermarketId: string) {
    const invoice = await Invoice.findByPk(invoiceId)
    if (!invoice) throw new Error('Fatura não encontrada.')
    if (invoice.supermarketId !== supermarketId) throw new Error('Fatura não pertence ao seu supermercado.')
    if (invoice.status !== 'pending' || !paymentGatewayService.configured) return invoice

    const approved = await paymentGatewayService.findApprovedPayment(`${INVOICE_REF_PREFIX}${invoice.id}`)
    if (approved) {
      await invoice.update({ status: 'paid', paidAt: new Date(), paymentRef: approved.id })
    }
    return invoice.reload()
  },

  /**
   * Baixa manual da agência — usada quando o pagamento pelo app está desligado (no geral ou pra
   * este cliente) e a agência recebeu o valor por fora, combinado direto com o supermercado.
   */
  async markInvoicePaidByAgency(invoiceId: string, agencyId: string) {
    const invoice = await Invoice.findByPk(invoiceId)
    if (!invoice) throw new Error('Fatura não encontrada.')
    if (invoice.agencyId !== agencyId) throw new Error('Fatura não pertence à sua agência.')
    if (invoice.status !== 'pending') throw new Error('Esta fatura não está pendente.')
    await invoice.update({ status: 'paid', paidAt: new Date(), paymentProvider: 'manual' })
    return invoice.reload()
  },

  /** Webhook do Mercado Pago: confirma a fatura quando o `external_reference` é `invoice:<id>`. */
  async handleInvoiceWebhook(body: any) {
    const type = body?.type || body?.topic
    const paymentId = body?.data?.id || body?.['data.id'] || body?.resource
    if (type !== 'payment' || !paymentId) return
    const payment = await paymentGatewayService.getPayment(String(paymentId))
    if (payment.status !== 'approved') return
    const ref = payment.external_reference ?? ''
    if (!ref.startsWith(INVOICE_REF_PREFIX)) return
    const invoice = await Invoice.findByPk(ref.slice(INVOICE_REF_PREFIX.length))
    if (!invoice || invoice.status !== 'pending') return
    await invoice.update({ status: 'paid', paidAt: new Date(), paymentRef: String(paymentId) })
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
