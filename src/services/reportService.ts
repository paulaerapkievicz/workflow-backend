import { Op } from 'sequelize'
import { Job } from '../models/Job'
import { Payment } from '../models/Payment'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'
import { Supermarket } from '../models/Supermarket'
import { Freelancer } from '../models/Freelancer'
import { JobShift } from '../models/JobShift'
import { JobShiftBreak } from '../models/JobShiftBreak'
import { JobLog } from '../models/JobLog'
import { round2, PAYMENT_OVERDUE_HOLD_DAYS } from '../helpers/time'

const shiftsInclude = { model: JobShift, as: 'shifts', include: [{ model: JobShiftBreak, as: 'breaks' }] }

/** 'received' (já liquidado) | 'awaiting' (retido, dentro do prazo) | 'overdue' (retido há tempo demais). */
function paymentStatusFor(job: { settlementHold?: boolean; completedAt?: Date | string | null }, hasPayment: boolean): 'received' | 'awaiting' | 'overdue' | null {
  if (hasPayment) return 'received'
  if (!job.settlementHold) return null
  const heldSince = job.completedAt ? new Date(job.completedAt).getTime() : Date.now()
  const days = (Date.now() - heldSince) / (24 * 60 * 60 * 1000)
  return days >= PAYMENT_OVERDUE_HOLD_DAYS ? 'overdue' : 'awaiting'
}

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
        shiftsInclude,
      ],
      order: [['completedAt', 'DESC']],
    })

    const items = jobs.map((j) => {
      const payment = (j as any).jobPayment
      return {
        jobId: j.id,
        title: j.title,
        date: j.completedAt,
        categoryId: j.categoryId,
        categoryName: (j as any).jobCategory?.name ?? null,
        branchId: j.branchId,
        branchName: (j as any).jobBranch?.name ?? null,
        supermarketName: (j as any).jobSupermarket?.name ?? null,
        contractedHours: round2((j.contractedMinutes ?? 0) / 60),
        workedHours: round2((j.workedMinutes ?? 0) / 60),
        amount: payment ? Number(payment.freelancerAmount) : 0,
        paymentStatus: paymentStatusFor(j, !!payment),
        shifts: (j as any).shifts ?? [],
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

  /**
   * Desfecho de cada vaga do colaborador (aceita/ativa/concluída/abandono) + as
   * "desistências" antes de começar — que somem do `freelancerId` da vaga (ela volta pro
   * pool) e por isso só são reconstruíveis a partir do `JobLog` (ver initiatedBy em JobLog.ts).
   * Alimenta os tiles clicáveis do Dashboard.
   */
  async freelancerOutcomes(freelancerId: string) {
    const own = await Job.findAll({
      where: { freelancerId },
      include: [
        { model: Category, as: 'jobCategory' },
        { model: Branch, as: 'jobBranch' },
        { model: Supermarket, as: 'jobSupermarket' },
      ],
      order: [['startTime', 'DESC']],
    })

    const toItem = (j: any, outcome: string) => ({
      jobId: j.id,
      title: j.title,
      date: j.startTime,
      categoryId: j.categoryId,
      categoryName: j.jobCategory?.name ?? null,
      branchId: j.branchId,
      branchName: j.jobBranch?.name ?? null,
      supermarketName: j.jobSupermarket?.name ?? null,
      outcome,
    })

    const items: ReturnType<typeof toItem>[] = []
    const counts = { accepted: 0, active: 0, completed: 0, abandoned: 0, withdrawnEarly: 0 }

    const abandonedJobIds = new Set(
      (
        await JobLog.findAll({
          where: { freelancerId, eventType: 'withdrawn', initiatedBy: 'freelancer' },
          attributes: ['jobId'],
        })
      ).map((l) => l.jobId)
    )

    for (const j of own) {
      if (j.status === 'accepted') { counts.accepted++; items.push(toItem(j, 'accepted')); continue }
      if (j.status === 'in_progress') { counts.active++; items.push(toItem(j, 'active')); continue }
      if (j.status === 'completed') { counts.completed++; items.push(toItem(j, 'completed')); continue }
      if (j.status === 'canceled' && (j.workedMinutes ?? 0) > 0 && abandonedJobIds.has(j.id)) {
        counts.abandoned++
        items.push(toItem(j, 'abandoned'))
      }
    }

    // Desistência antes de começar: a vaga voltou pro pool (freelancerId não é mais este
    // colaborador), então só sobrevive no JobLog.
    const withdrawnLogs = await JobLog.findAll({
      where: { freelancerId, eventType: 'withdrawn', initiatedBy: 'freelancer' },
      include: [
        {
          model: Job,
          as: 'logJob',
          include: [
            { model: Category, as: 'jobCategory' },
            { model: Branch, as: 'jobBranch' },
            { model: Supermarket, as: 'jobSupermarket' },
          ],
        },
      ],
      order: [['timestamp', 'DESC']],
    })
    for (const log of withdrawnLogs as any[]) {
      const j = log.logJob
      if (!j || j.freelancerId === freelancerId) continue // já contado acima (abandono)
      counts.withdrawnEarly++
      items.push({ ...toItem(j, 'withdrawnEarly'), date: log.timestamp })
    }

    items.sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime())
    return { counts, items }
  },
}
