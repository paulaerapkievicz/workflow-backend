import { Job } from '../models/Job'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'
import { Freelancer } from '../models/Freelancer'
import { Invoice } from '../models/Invoice'
import { Agency } from '../models/Agency'
import { referenceMonthOf, round2 } from '../helpers/time'

/**
 * Faturamento do supermercado: histórico por mês, com total de vagas,
 * horas contratadas x trabalhadas, valor total e quebra por função.
 */
export const billingService = {
  async summaryForSupermarket(supermarketId: string) {
    const jobs = await Job.findAll({
      where: { supermarketId, status: 'completed' },
      include: [
        { model: Category, as: 'jobCategory' },
        { model: Branch, as: 'jobBranch' },
        { model: Freelancer, as: 'assignedFreelancer' },
      ],
      order: [['completedAt', 'DESC']],
    })

    const monthMap = new Map<string, any>()
    for (const job of jobs) {
      const ref = job.completedAt ? referenceMonthOf(job.completedAt) : 'sem-data'
      if (!monthMap.has(ref)) {
        monthMap.set(ref, {
          referenceMonth: ref,
          totalJobs: 0,
          contractedMinutes: 0,
          workedMinutes: 0,
          totalAmount: 0,
          byCategory: new Map<string, any>(),
        })
      }
      const m = monthMap.get(ref)
      const amount = Number(job.grossAmount ?? 0)
      m.totalJobs += 1
      m.contractedMinutes += job.contractedMinutes ?? 0
      m.workedMinutes += job.workedMinutes ?? 0
      m.totalAmount += amount

      const catId = job.categoryId
      const catName = (job as any).jobCategory?.name ?? 'Sem função'
      if (!m.byCategory.has(catId)) {
        m.byCategory.set(catId, {
          categoryId: catId,
          categoryName: catName,
          count: 0,
          contractedMinutes: 0,
          workedMinutes: 0,
          amount: 0,
        })
      }
      const c = m.byCategory.get(catId)
      c.count += 1
      c.contractedMinutes += job.contractedMinutes ?? 0
      c.workedMinutes += job.workedMinutes ?? 0
      c.amount += amount
    }

    const invoices = await Invoice.findAll({
      where: { supermarketId, type: 'monthly' },
      include: [{ model: Agency, as: 'invoiceAgency' }],
      order: [['referenceMonth', 'DESC']],
    })
    const invoiceByMonth = new Map<string, any[]>()
    for (const inv of invoices) {
      const key = inv.referenceMonth ?? 'sem-data'
      if (!invoiceByMonth.has(key)) invoiceByMonth.set(key, [])
      invoiceByMonth.get(key)!.push(inv)
    }

    const months = [...monthMap.values()]
      .map((m) => ({
        referenceMonth: m.referenceMonth,
        totalJobs: m.totalJobs,
        contractedHours: round2(m.contractedMinutes / 60),
        workedHours: round2(m.workedMinutes / 60),
        totalAmount: round2(m.totalAmount),
        byCategory: [...m.byCategory.values()]
          .map((c: any) => ({
            categoryId: c.categoryId,
            categoryName: c.categoryName,
            count: c.count,
            contractedHours: round2(c.contractedMinutes / 60),
            workedHours: round2(c.workedMinutes / 60),
            amount: round2(c.amount),
          }))
          .sort((a, b) => b.count - a.count),
        invoices: (invoiceByMonth.get(m.referenceMonth) ?? []).map((inv: any) => ({
          id: inv.id,
          agencyName: inv.invoiceAgency?.name ?? null,
          totalAmount: Number(inv.totalAmount),
          status: inv.status,
        })),
      }))
      .sort((a, b) => (a.referenceMonth < b.referenceMonth ? 1 : -1))

    const totals = {
      totalJobs: jobs.length,
      contractedHours: round2(jobs.reduce((a, j) => a + (j.contractedMinutes ?? 0), 0) / 60),
      workedHours: round2(jobs.reduce((a, j) => a + (j.workedMinutes ?? 0), 0) / 60),
      totalAmount: round2(jobs.reduce((a, j) => a + Number(j.grossAmount ?? 0), 0)),
      openInvoicesAmount: round2(
        invoices.filter((i) => i.status === 'pending').reduce((a, i) => a + Number(i.totalAmount), 0)
      ),
      paidInvoicesAmount: round2(
        invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + Number(i.totalAmount), 0)
      ),
    }

    return { months, totals }
  },
}
