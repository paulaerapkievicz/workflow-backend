import { Job } from '../models/Job'
import { Payment } from '../models/Payment'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'
import { Supermarket } from '../models/Supermarket'
import { Freelancer } from '../models/Freelancer'
import { round2 } from '../helpers/time'

/** Relatório de trabalhos concluídos e valores recebidos pelo freelancer. */
export const reportService = {
  async freelancerReport(freelancerId: string) {
    const freelancer = await Freelancer.findByPk(freelancerId)
    const jobs = await Job.findAll({
      where: { freelancerId, status: 'completed' },
      include: [
        { model: Category, as: 'jobCategory' },
        { model: Branch, as: 'jobBranch' },
        { model: Supermarket, as: 'jobSupermarket' },
        { model: Payment, as: 'jobPayment' },
      ],
      order: [['completedAt', 'DESC']],
    })

    const items = jobs.map((j) => {
      const payment = (j as any).jobPayment
      return {
        jobId: j.id,
        title: j.title,
        date: j.completedAt,
        categoryName: (j as any).jobCategory?.name ?? null,
        branchName: (j as any).jobBranch?.name ?? null,
        supermarketName: (j as any).jobSupermarket?.name ?? null,
        contractedHours: round2((j.contractedMinutes ?? 0) / 60),
        workedHours: round2((j.workedMinutes ?? 0) / 60),
        amount: payment ? Number(payment.freelancerAmount) : 0,
      }
    })

    const totals = {
      jobsCount: items.length,
      contractedHours: round2(items.reduce((a, i) => a + i.contractedHours, 0)),
      workedHours: round2(items.reduce((a, i) => a + i.workedHours, 0)),
      earned: round2(items.reduce((a, i) => a + i.amount, 0)),
      availableBalance: freelancer ? Number(freelancer.availableBalance) : 0,
    }

    return { items, totals }
  },
}
