import { Op } from 'sequelize'
import { sequelize } from '../database'
import { Job, JobCreationAttributes } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { Freelancer, FreelancerInstance } from '../models/Freelancer'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'
import { Supermarket } from '../models/Supermarket'
import { JobLog } from '../models/JobLog'
import { JobPhoto } from '../models/JobPhoto'
import { Payment } from '../models/Payment'
import { Review } from '../models/Review'
import { Order } from '../models/Order'
import { OrderItem } from '../models/OrderItem'
import { UserInstance } from '../models/User'
import { profileService } from './profileService'
import { orderService } from './orderService'
import { agencyRateService } from './agencyRateService'
import { minutesBetween } from '../helpers/time'

const jobIncludes = [
  { model: Supermarket, as: 'jobSupermarket' },
  { model: Branch, as: 'jobBranch' },
  { model: Category, as: 'jobCategory' },
  { model: Freelancer, as: 'assignedFreelancer' },
  { model: JobShift, as: 'shifts' },
  { model: JobLog, as: 'jobLogs' },
  { model: JobPhoto, as: 'jobPhotos' },
  { model: Payment, as: 'jobPayment' },
  { model: Review, as: 'jobReview' },
  { model: Order, as: 'jobOrder' },
  { model: OrderItem, as: 'jobOrderItem' },
]

const shiftOrder: any = [[{ model: JobShift, as: 'shifts' }, 'position', 'ASC']]

/** Soma dos minutos contratados dos turnos de uma vaga. */
function sumShiftMinutes(shifts: { startTime: Date | string; endTime: Date | string }[]) {
  return shifts.reduce((acc, s) => acc + minutesBetween(s.startTime, s.endTime), 0)
}

interface ShiftInput {
  startTime: string | Date
  endTime: string | Date
  label?: string | null
}

function normalizeShifts(raw: any): ShiftInput[] {
  const list: any[] = Array.isArray(raw?.shifts) ? raw.shifts : []
  if (!list.length) {
    // compat: aceita startTime/endTime únicos como um turno só
    if (raw?.startTime && raw?.endTime) return [{ startTime: raw.startTime, endTime: raw.endTime }]
    throw new Error('Informe ao menos um turno de trabalho.')
  }
  return list.map((s, i) => {
    if (!s.startTime || !s.endTime) throw new Error(`Turno ${i + 1}: informe início e fim.`)
    if (new Date(s.endTime) <= new Date(s.startTime)) {
      throw new Error(`Turno ${i + 1}: o fim precisa ser depois do início.`)
    }
    return { startTime: s.startTime, endTime: s.endTime, label: s.label ?? null }
  })
}

export const jobService = {
  async findById(id: string) {
    return Job.findByPk(id, { include: jobIncludes })
  },

  async listForUser(user: UserInstance) {
    if (user.role === 'admin') {
      return Job.findAll({ include: jobIncludes, order: [['createdAt', 'DESC']] })
    }

    if (user.role === 'supermarket') {
      const supermarketId = await profileService.supermarketIdForUser(user)
      if (!supermarketId) return []
      return Job.findAll({ where: { supermarketId }, include: jobIncludes, order: [['createdAt', 'DESC']] })
    }

    if (user.role === 'freelancer') {
      const freelancer = await profileService.freelancerForUser(user)
      if (!freelancer) return []
      return Job.findAll({
        where: {
          [Op.or]: [{ freelancerId: freelancer.id }, { status: 'pending', freelancerId: null }],
        },
        include: jobIncludes,
        order: [['startTime', 'ASC']],
      })
    }

    if (user.role === 'agency') {
      const agencyId = await profileService.agencyIdForUser(user)
      if (!agencyId) return []
      // A agência acompanha e controla todas as vagas (pool aberto + as da sua rede).
      return Job.findAll({ include: jobIncludes, order: [['createdAt', 'DESC']] })
    }

    return []
  },

  async availableForFreelancer(freelancer: FreelancerInstance | null) {
    if (!freelancer) return []
    if (freelancer.blockedUntil && new Date(freelancer.blockedUntil) > new Date()) {
      return []
    }
    const where: any = { status: 'pending', freelancerId: null }
    // Só oferece vagas cuja função a agência do freelancer já precifica.
    if (freelancer.agencyId) {
      const rates = await agencyRateService.listForAgency(freelancer.agencyId)
      const priced = rates.filter((r) => r.active).map((r) => r.categoryId)
      where.categoryId = { [Op.in]: priced.length ? priced : ['00000000-0000-0000-0000-000000000000'] }
    }
    return Job.findAll({ where, include: jobIncludes, order: [['startTime', 'ASC']] })
  },

  /** Vagas em andamento da rede da agência, com o último ponto de localização. */
  async liveForAgency(agencyId: string) {
    const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id'] })
    const ids = freelancers.map((f) => f.id)
    if (!ids.length) return []
    return Job.findAll({
      where: { status: 'in_progress', freelancerId: { [Op.in]: ids } },
      include: jobIncludes,
      order: [['startTime', 'ASC']],
    })
  },

  // Compat: cria uma vaga avulsa como um pedido de 1 item (sem valor — a agência precifica).
  async create(data: any, supermarketId: string) {
    const order = await orderService.create(
      {
        branchId: data.branchId,
        notes: data.notes ?? null,
        items: [
          {
            categoryId: data.categoryId,
            title: data.title,
            description: data.description ?? null,
            quantity: Number(data.quantity) > 1 ? Number(data.quantity) : 1,
            photosRequired: data.photosRequired !== false,
            agencyReviewEnabled: data.agencyReviewEnabled === true,
            shifts: Array.isArray(data.shifts) && data.shifts.length
              ? data.shifts
              : data.startTime && data.endTime
              ? [{ startTime: data.startTime, endTime: data.endTime }]
              : [],
          },
        ],
      },
      supermarketId
    )
    const firstJob = (order as any)?.orderJobs?.[0]
    return firstJob ? this.findById(firstJob.id) : order
  },

  async update(id: string, data: any, supermarketId: string) {
    const job = await this.assertOwned(id, supermarketId)
    if (job.status !== 'pending') {
      throw new Error('Só é possível editar a vaga enquanto ela está disponível (sem freelancer).')
    }

    const patch: any = {
      title: data.title ?? job.title,
      description: data.description ?? job.description,
      branchId: data.branchId ?? job.branchId,
      categoryId: data.categoryId ?? job.categoryId,
      paymentAmount: data.paymentAmount != null ? Number(data.paymentAmount) : job.paymentAmount,
      photosRequired: data.photosRequired != null ? data.photosRequired !== false : job.photosRequired,
      agencyReviewEnabled:
        data.agencyReviewEnabled != null ? data.agencyReviewEnabled === true : job.agencyReviewEnabled,
    }

    if (patch.branchId !== job.branchId) {
      const branch = await Branch.findByPk(patch.branchId)
      if (!branch || branch.supermarketId !== supermarketId) throw new Error('Filial inválida.')
    }

    await sequelize.transaction(async (t) => {
      if (Array.isArray(data.shifts) && data.shifts.length) {
        const shifts = normalizeShifts(data)
        await JobShift.destroy({ where: { jobId: id }, transaction: t })
        await JobShift.bulkCreate(
          shifts.map((s, i) => ({
            jobId: id,
            position: i,
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime),
            label: s.label ?? null,
          })),
          { transaction: t }
        )
        patch.startTime = new Date(Math.min(...shifts.map((s) => new Date(s.startTime).getTime())))
        patch.endTime = new Date(Math.max(...shifts.map((s) => new Date(s.endTime).getTime())))
        patch.contractedMinutes = shifts.reduce(
          (acc, s) => acc + minutesBetween(s.startTime, s.endTime),
          0
        )
      }
      await job.update(patch, { transaction: t })
    })

    return this.findById(id)
  },

  async remove(id: string, supermarketId: string) {
    const job = await this.assertOwned(id, supermarketId)
    if (!['pending', 'canceled'].includes(job.status)) {
      throw new Error('Não é possível excluir uma vaga que já foi aceita.')
    }
    await job.destroy()
    return { message: 'Vaga removida.' }
  },

  async cancel(id: string, supermarketId: string) {
    const job = await this.assertOwned(id, supermarketId)
    if (job.status !== 'pending') {
      throw new Error('Só é possível cancelar uma vaga ainda disponível.')
    }
    await job.update({ status: 'canceled' })
    await orderService.syncStatus(job.orderId)
    return this.findById(id)
  },

  async accept(id: string, freelancer: FreelancerInstance) {
    if (!freelancer.agencyId) {
      throw new Error('Você precisa estar vinculado a uma agência para aceitar vagas.')
    }
    if (freelancer.blockedUntil && new Date(freelancer.blockedUntil) > new Date()) {
      throw new Error('Você está temporariamente bloqueado para novas vagas.')
    }
    const job = await Job.findByPk(id, { include: [{ model: JobShift, as: 'shifts' }] })
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.status !== 'pending' || job.freelancerId) {
      throw new Error('Esta vaga não está mais disponível.')
    }

    // A vaga só pode ser assumida se a agência do freelancer tiver valor/hora para a função.
    const rate = await agencyRateService.activeRate(freelancer.agencyId, job.categoryId)
    if (!rate) {
      throw new Error('Sua agência ainda não definiu um valor/hora para esta função.')
    }

    const shifts = (job as any).shifts ?? []
    const contractedMinutes = job.contractedMinutes ?? (shifts.length ? sumShiftMinutes(shifts) : null)

    await job.update({ freelancerId: freelancer.id, status: 'accepted', contractedMinutes })
    await orderService.syncStatus(job.orderId)
    return this.findById(id)
  },

  // Agência registra que o freelancer da sua rede não concluiu a vaga.
  async registerNoShow(id: string, agencyId: string, reason: string) {
    if (!reason || !reason.trim()) throw new Error('Informe o motivo da falta.')
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (!['accepted', 'in_progress'].includes(job.status)) {
      throw new Error('Só é possível registrar falta em vaga aceita ou em andamento.')
    }
    const freelancer = job.freelancerId ? await Freelancer.findByPk(job.freelancerId) : null
    if (!freelancer || freelancer.agencyId !== agencyId) {
      throw new Error('Este freelancer não pertence à sua agência.')
    }

    const blockedUntil = new Date()
    blockedUntil.setDate(blockedUntil.getDate() + 7)

    await sequelize.transaction(async (t) => {
      await JobLog.create(
        { jobId: id, freelancerId: freelancer.id, eventType: 'no-show', reason: reason.trim(), timestamp: new Date() },
        { transaction: t }
      )
      await JobLog.destroy({
        where: { jobId: id, freelancerId: freelancer.id, eventType: { [Op.in]: ['check-in', 'check-out', 'break-start', 'break-end'] } },
        transaction: t,
      })
      await JobShift.update(
        { status: 'pending', checkInAt: null, checkOutAt: null, workedMinutes: null },
        { where: { jobId: id }, transaction: t }
      )
      await freelancer.update({ blockedUntil }, { transaction: t })
      await job.update(
        { freelancerId: null, status: 'pending', workedMinutes: null, grossAmount: null, completedAt: null },
        { transaction: t }
      )
    })

    await orderService.syncStatus(job.orderId)
    return this.findById(id)
  },

  async assertOwned(id: string, supermarketId: string) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.supermarketId !== supermarketId) throw new Error('Vaga não pertence ao seu supermercado.')
    return job
  },
}
