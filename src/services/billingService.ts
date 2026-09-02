import { Job } from '../models/Job'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'
import { Order } from '../models/Order'
import { Freelancer } from '../models/Freelancer'
import { Invoice } from '../models/Invoice'
import { Agency } from '../models/Agency'
import { referenceMonthOf, round2 } from '../helpers/time'

/**
 * Faturamento do supermercado — dados "crus" das vagas concluídas + faturas.
 * O front monta os cruzamentos (total/filial, mês, função, pedido) e os filtros.
 */
export const billingService = {
  async summaryForSupermarket(supermarketId: string) {
    const jobs = await Job.findAll({
      where: { supermarketId, status: 'completed' },
      include: [
        { model: Category, as: 'jobCategory' },
        { model: Branch, as: 'jobBranch' },
        { model: Freelancer, as: 'assignedFreelancer' },
        { model: Order, as: 'jobOrder' },
      ],
      order: [['completedAt', 'DESC']],
    })

    const rows = jobs.map((j) => {
      const order = (j as any).jobOrder
      return {
        jobId: j.id,
        title: j.title,
        completedAt: j.completedAt,
        referenceMonth: j.completedAt ? referenceMonthOf(j.completedAt) : null,
        branchId: j.branchId,
        branchName: (j as any).jobBranch?.name ?? '—',
        categoryId: j.categoryId,
        categoryName: (j as any).jobCategory?.name ?? '—',
        shiftPeriod: j.shiftPeriod ?? null,
        orderId: j.orderId ?? null,
        orderCreatedAt: order?.createdAt ?? null,
        freelancerName: (j as any).assignedFreelancer?.name ?? null,
        contractedMinutes: j.contractedMinutes ?? 0,
        workedMinutes: j.workedMinutes ?? 0,
        amount: Number(j.grossAmount ?? 0),
        invoiceId: j.monthlyInvoiceId ?? null,
      }
    })

    const branches = await Branch.findAll({
      where: { supermarketId },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    })

    const invoices = await Invoice.findAll({
      where: { supermarketId, type: 'monthly' },
      include: [
        { model: Agency, as: 'invoiceAgency', attributes: ['id', 'name'] },
        { model: Branch, as: 'invoiceBranch', attributes: ['id', 'name'] },
      ],
      order: [['referenceMonth', 'DESC']],
    })

    const invoiceRows = invoices.map((i) => ({
      id: i.id,
      referenceMonth: i.referenceMonth,
      agencyName: (i as any).invoiceAgency?.name ?? null,
      branchId: i.branchId ?? null,
      branchName: (i as any).invoiceBranch?.name ?? null,
      totalJobs: i.totalJobs ?? 0,
      contractedMinutes: i.contractedMinutes ?? 0,
      workedMinutes: i.workedMinutes ?? 0,
      totalAmount: Number(i.totalAmount),
      status: i.status,
      createdAt: i.createdAt,
    }))

    const totals = {
      totalJobs: rows.length,
      contractedHours: round2(rows.reduce((a, r) => a + r.contractedMinutes, 0) / 60),
      workedHours: round2(rows.reduce((a, r) => a + r.workedMinutes, 0) / 60),
      totalAmount: round2(rows.reduce((a, r) => a + r.amount, 0)),
      openInvoicesAmount: round2(
        invoiceRows.filter((i) => i.status === 'pending').reduce((a, i) => a + i.totalAmount, 0)
      ),
      paidInvoicesAmount: round2(
        invoiceRows.filter((i) => i.status === 'paid').reduce((a, i) => a + i.totalAmount, 0)
      ),
    }

    return { jobs: rows, branches, invoices: invoiceRows, totals }
  },
}
