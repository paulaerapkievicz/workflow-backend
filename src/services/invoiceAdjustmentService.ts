import { sequelize } from '../database'
import { Invoice } from '../models/Invoice'
import { InvoiceAdjustment } from '../models/InvoiceAdjustment'
import { Agency } from '../models/Agency'
import { User } from '../models/User'
import { round2 } from '../helpers/time'

const adjustmentIncludes = [{ model: User, as: 'adjustmentAuthor', attributes: ['id', 'name', 'email'] }]

/** Valor líquido a pagar = total do fechamento menos os abatimentos já aprovados. */
export function invoiceNetAmount(invoice: Pick<Invoice, 'totalAmount' | 'adjustmentsTotal'>) {
  return round2(Number(invoice.totalAmount) - Number(invoice.adjustmentsTotal ?? 0))
}

async function loadInvoice(invoiceId: string) {
  const invoice = await Invoice.findByPk(invoiceId)
  if (!invoice) throw new Error('Fatura não encontrada.')
  if (invoice.type !== 'monthly') throw new Error('Só o fechamento mensal aceita contestação.')
  return invoice
}

async function pendingAdjustmentsTotal(invoiceId: string, exceptId?: string) {
  const rows = await InvoiceAdjustment.findAll({ where: { invoiceId, status: 'pending' } })
  return rows
    .filter((r) => r.id !== exceptId)
    .reduce((acc, r) => acc + Number(r.amount), 0)
}

export const invoiceAdjustmentService = {
  invoiceNetAmount,

  async listForInvoice(
    invoiceId: string,
    scope?: { supermarketId?: string; agencyId?: string }
  ) {
    if (scope?.supermarketId || scope?.agencyId) {
      const invoice = await loadInvoice(invoiceId)
      if (scope.supermarketId && invoice.supermarketId !== scope.supermarketId) {
        throw new Error('Fatura não pertence ao seu supermercado.')
      }
      if (scope.agencyId && invoice.agencyId !== scope.agencyId) {
        throw new Error('Fatura não pertence à sua agência.')
      }
    }
    return InvoiceAdjustment.findAll({
      where: { invoiceId },
      include: adjustmentIncludes,
      order: [['createdAt', 'ASC']],
    })
  },

  async countPendingForAgency(agencyId: string) {
    return InvoiceAdjustment.count({
      where: { status: 'pending' },
      include: [{ model: Invoice, as: 'adjustmentInvoice', attributes: [], where: { agencyId } }],
    })
  },

  // Supermercado lança uma contestação (status `pending`) numa fatura ainda em aberto.
  async createBySupermarket(
    invoiceId: string,
    supermarketId: string,
    userId: string,
    data: { description?: string; amount?: number | string }
  ) {
    const invoice = await loadInvoice(invoiceId)
    if (invoice.supermarketId !== supermarketId) throw new Error('Fatura não pertence ao seu supermercado.')
    if (invoice.status !== 'pending') throw new Error('Só dá para contestar uma fatura pendente.')

    const description = String(data.description ?? '').trim()
    if (!description) throw new Error('Descreva o abatimento (ex.: "Quebra de caixa 12/03").')

    const amount = round2(Number(data.amount))
    if (!(amount > 0)) throw new Error('Informe um valor de abatimento maior que zero.')

    const alreadyCommitted = Number(invoice.adjustmentsTotal ?? 0) + (await pendingAdjustmentsTotal(invoiceId))
    if (alreadyCommitted + amount > Number(invoice.totalAmount)) {
      throw new Error('A soma dos abatimentos não pode passar do valor da fatura.')
    }

    return InvoiceAdjustment.create({
      invoiceId,
      description,
      amount,
      status: 'pending',
      createdBy: userId,
    })
  },

  async removeBySupermarket(invoiceId: string, adjustmentId: string, supermarketId: string) {
    const invoice = await loadInvoice(invoiceId)
    if (invoice.supermarketId !== supermarketId) throw new Error('Fatura não pertence ao seu supermercado.')
    const adjustment = await InvoiceAdjustment.findByPk(adjustmentId)
    if (!adjustment || adjustment.invoiceId !== invoiceId) throw new Error('Contestação não encontrada.')
    if (adjustment.status !== 'pending') throw new Error('Só dá para remover uma contestação que ainda não foi resolvida.')
    await adjustment.destroy()
    return { removed: true }
  },

  // A agência aprova: o abatimento passa a valer (reduz o valor líquido) e a agência o absorve.
  async approve(invoiceId: string, adjustmentId: string, agencyId: string, userId: string) {
    const invoice = await loadInvoice(invoiceId)
    if (invoice.agencyId !== agencyId) throw new Error('Fatura não pertence à sua agência.')
    if (invoice.status !== 'pending') throw new Error('A fatura já foi paga — não dá para aprovar abatimento.')

    const adjustment = await InvoiceAdjustment.findByPk(adjustmentId)
    if (!adjustment || adjustment.invoiceId !== invoiceId) throw new Error('Contestação não encontrada.')
    if (adjustment.status !== 'pending') throw new Error('Esta contestação já foi resolvida.')

    const amount = Number(adjustment.amount)
    if (Number(invoice.adjustmentsTotal ?? 0) + amount > Number(invoice.totalAmount)) {
      throw new Error('A soma dos abatimentos aprovados não pode passar do valor da fatura.')
    }

    return sequelize.transaction(async (t) => {
      await adjustment.update(
        { status: 'approved', resolvedBy: userId, resolvedAt: new Date() },
        { transaction: t }
      )
      await invoice.increment('adjustmentsTotal', { by: amount, transaction: t })
      const agency = await Agency.findByPk(agencyId, { transaction: t })
      if (agency) await agency.decrement('availableBalance', { by: amount, transaction: t })
      return adjustment.reload({ include: adjustmentIncludes, transaction: t })
    })
  },

  async reject(
    invoiceId: string,
    adjustmentId: string,
    agencyId: string,
    userId: string,
    data: { note?: string }
  ) {
    const invoice = await loadInvoice(invoiceId)
    if (invoice.agencyId !== agencyId) throw new Error('Fatura não pertence à sua agência.')

    const adjustment = await InvoiceAdjustment.findByPk(adjustmentId)
    if (!adjustment || adjustment.invoiceId !== invoiceId) throw new Error('Contestação não encontrada.')
    if (adjustment.status !== 'pending') throw new Error('Esta contestação já foi resolvida.')

    const note = String(data.note ?? '').trim()
    if (!note) throw new Error('Informe o motivo da recusa.')

    await adjustment.update({
      status: 'rejected',
      resolvedBy: userId,
      resolvedAt: new Date(),
      agencyNote: note,
    })
    return adjustment.reload({ include: adjustmentIncludes })
  },

  // Desfaz um abatimento já aprovado (enquanto a fatura ainda não foi paga): estorna os valores.
  async revert(invoiceId: string, adjustmentId: string, agencyId: string) {
    const invoice = await loadInvoice(invoiceId)
    if (invoice.agencyId !== agencyId) throw new Error('Fatura não pertence à sua agência.')
    if (invoice.status !== 'pending') throw new Error('A fatura já foi paga — não dá para reverter abatimento.')

    const adjustment = await InvoiceAdjustment.findByPk(adjustmentId)
    if (!adjustment || adjustment.invoiceId !== invoiceId) throw new Error('Contestação não encontrada.')
    if (adjustment.status !== 'approved') throw new Error('Só dá para reverter um abatimento aprovado.')

    const amount = Number(adjustment.amount)
    return sequelize.transaction(async (t) => {
      await adjustment.update(
        { status: 'pending', resolvedBy: null, resolvedAt: null },
        { transaction: t }
      )
      await invoice.decrement('adjustmentsTotal', { by: amount, transaction: t })
      const agency = await Agency.findByPk(agencyId, { transaction: t })
      if (agency) await agency.increment('availableBalance', { by: amount, transaction: t })
      return adjustment.reload({ include: adjustmentIncludes, transaction: t })
    })
  },

  async assertNoPending(invoiceId: string) {
    const pending = await InvoiceAdjustment.count({ where: { invoiceId, status: 'pending' } })
    if (pending > 0) {
      throw new Error(
        'Existem contestações aguardando a agência. Aguarde a resolução para pagar o valor líquido.'
      )
    }
  },
}
