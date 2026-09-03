import { Op, Transaction } from 'sequelize'
import { sequelize } from '../database'
import { Job } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { Freelancer, FreelancerInstance } from '../models/Freelancer'
import { FreelancerCategory } from '../models/FreelancerCategory'
import { Category } from '../models/Category'
import { Branch } from '../models/Branch'
import { Supermarket } from '../models/Supermarket'
import { JobLog } from '../models/JobLog'
import { JobPhoto } from '../models/JobPhoto'
import { Payment } from '../models/Payment'
import { Review } from '../models/Review'
import { Order } from '../models/Order'
import { OrderItem } from '../models/OrderItem'
import { FreelancerContract } from '../models/FreelancerContract'
import { UserInstance } from '../models/User'
import { Agency } from '../models/Agency'
import { SupermarketCategoryRate } from '../models/SupermarketCategoryRate'
import { profileService } from './profileService'
import { orderService, OrderContext } from './orderService'
import { supermarketRateService } from './supermarketRateService'
import { freelancerService } from './freelancerService'
import { paymentService } from './paymentService'
import { minutesBetween } from '../helpers/time'
import { resolveShifts } from '../helpers/shifts'

const BR_TZ = 'America/Sao_Paulo'
const fmtWindow = (a: Date | string, b: Date | string) => {
  const d = (x: Date | string) =>
    new Date(x).toLocaleString('pt-BR', { timeZone: BR_TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  return `${d(a)}–${new Date(b).toLocaleTimeString('pt-BR', { timeZone: BR_TZ, hour: '2-digit', minute: '2-digit' })}`
}

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

/** Soma dos minutos contratados dos turnos de uma vaga. */
function sumShiftMinutes(shifts: { startTime: Date | string; endTime: Date | string }[]) {
  return shifts.reduce((acc, s) => acc + minutesBetween(s.startTime, s.endTime), 0)
}

/**
 * Se a agência exige onboarding, o colaborador só trabalha depois de concluir o perfil
 * contratual E ter o uniforme aprovado. Retorna a mensagem de bloqueio ou null.
 */
export async function onboardingBlockReason(freelancer: FreelancerInstance): Promise<string | null> {
  if (!freelancer.agencyId) return null
  const agency = await Agency.findByPk(freelancer.agencyId)
  if (!agency?.onboardingRequired) return null
  const contract = await FreelancerContract.findOne({ where: { freelancerId: freelancer.id } })
  if (!contract?.completedAt) return 'Preencha o perfil contratual para aceitar vagas.'
  if (!freelancer.onboardingApprovedAt) return 'Aguarde a aprovação do seu uniforme para aceitar vagas.'
  return null
}

/** Campos de override de configuração operacional por vaga. */
const JOB_CONFIG_FIELDS = [
  'checkinRadius',
  'cancellationWindowMinutes',
  'requireCheckoutPhoto',
  'reviewEnabled',
] as const

/**
 * Aplica a edição de função/turno/data/título de uma vaga (usada pelo supermercado e
 * pela agência enquanto a vaga está disponível). Retorna o patch para `job.update`.
 */
async function applyJobEdit(job: any, data: any, t: Transaction) {
  const patch: any = {}
  if (data.title != null) patch.title = String(data.title).trim() || job.title
  if (data.categoryId != null && data.categoryId !== job.categoryId) {
    const category = await Category.findByPk(data.categoryId)
    if (!category) throw new Error('Função (categoria) inválida.')
    patch.categoryId = data.categoryId
  }

  const date =
    data.date ??
    (job.startTime
      ? new Date(job.startTime).toLocaleDateString('en-CA', { timeZone: BR_TZ }) // YYYY-MM-DD em Brasília
      : null)
  const reshift =
    data.shifts != null ||
    data.shiftPeriod != null ||
    data.date != null ||
    data.startTime != null ||
    data.endTime != null

  if (reshift) {
    if (!date) throw new Error('Informe a data da vaga.')
    const rawShifts =
      Array.isArray(data.shifts) && data.shifts.length
        ? data.shifts
        : [{ shiftPeriod: data.shiftPeriod ?? job.shiftPeriod, startTime: data.startTime, endTime: data.endTime }]
    const shifts = resolveShifts(rawShifts, String(date))

    await JobShift.destroy({ where: { jobId: job.id }, transaction: t })
    for (let position = 0; position < shifts.length; position++) {
      const s = shifts[position]
      await JobShift.create(
        { jobId: job.id, position, startTime: s.startTime, endTime: s.endTime, label: s.label },
        { transaction: t }
      )
    }
    patch.shiftPeriod = shifts[0].shiftPeriod
    patch.startTime = shifts[0].startTime
    patch.endTime = shifts[shifts.length - 1].endTime
    patch.contractedMinutes = shifts.reduce((acc, s) => acc + minutesBetween(s.startTime, s.endTime), 0)
  }
  return patch
}

/**
 * Cancelamento da vaga pela agência (liberar ou registrar falta).
 * - Nenhum turno trabalhado: a vaga volta ao pool (pending, sem freelancer).
 * - Parte do turno trabalhada: a vaga original vira registro `canceled` do freelancer
 *   (com as horas trabalhadas liquidadas) e uma nova vaga `pending` com os turnos
 *   restantes vai para o pool de vagas disponíveis.
 */
async function cancelJobByAgency(
  job: any,
  freelancerId: string,
  eventType: 'withdrawn' | 'no-show',
  reason: string
) {
  const now = new Date()
  const shifts = await JobShift.findAll({ where: { jobId: job.id }, order: [['position', 'ASC']] })
  const workedShifts = shifts.filter((s) => s.status === 'done' && (s.workedMinutes ?? 0) > 0)

  if (!workedShifts.length) {
    await sequelize.transaction(async (t) => {
      await JobLog.create(
        { jobId: job.id, freelancerId, eventType, reason, timestamp: now },
        { transaction: t }
      )
      await JobLog.destroy({
        where: { jobId: job.id, freelancerId, eventType: { [Op.in]: ['check-in', 'check-out'] } },
        transaction: t,
      })
      await JobShift.update(
        { status: 'pending', checkInAt: null, checkOutAt: null, workedMinutes: null },
        { where: { jobId: job.id }, transaction: t }
      )
      await job.update(
        { freelancerId: null, status: 'pending', workedMinutes: null, grossAmount: null, completedAt: null },
        { transaction: t }
      )
    })
    await orderService.syncStatus(job.orderId)
    return
  }

  const remainingShifts = shifts.filter((s) => s.status !== 'done')
  const workedMinutes = workedShifts.reduce((acc, s) => acc + (s.workedMinutes ?? 0), 0)

  await sequelize.transaction(async (t) => {
    await JobLog.create(
      { jobId: job.id, freelancerId, eventType, reason, timestamp: now },
      { transaction: t }
    )
    // Turnos não trabalhados saem do registro da vaga cancelada.
    await JobShift.destroy({ where: { jobId: job.id, status: { [Op.ne]: 'done' } }, transaction: t })
    await job.update({ status: 'canceled', workedMinutes, completedAt: now }, { transaction: t })

    if (remainingShifts.length) {
      const config: any = {}
      for (const f of JOB_CONFIG_FIELDS) config[f] = job[f] ?? null
      const newJob = await Job.create(
        {
          supermarketId: job.supermarketId,
          branchId: job.branchId,
          categoryId: job.categoryId,
          orderId: job.orderId,
          orderItemId: job.orderItemId,
          shiftPeriod: job.shiftPeriod,
          title: `${job.title} (restante)`,
          status: 'pending',
          freelancerId: null,
          startTime: remainingShifts[0].startTime,
          endTime: remainingShifts[remainingShifts.length - 1].endTime,
          contractedMinutes: sumShiftMinutes(remainingShifts),
          ...config,
        },
        { transaction: t }
      )
      for (let position = 0; position < remainingShifts.length; position++) {
        const s = remainingShifts[position]
        await JobShift.create(
          { jobId: newJob.id, position, startTime: s.startTime, endTime: s.endTime, label: s.label },
          { transaction: t }
        )
      }
    }
  })

  // Liquida o que foi efetivamente trabalhado (settleForJob abre a própria transação).
  await paymentService.settleForJob(await job.reload())
  await orderService.syncStatus(job.orderId)
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
      const ctx = await profileService.supermarketContextForUser(user)
      if (!ctx) return []
      const where: any = { supermarketId: ctx.supermarketId }
      if (ctx.branchId) where.branchId = ctx.branchId
      return Job.findAll({ where, include: jobIncludes, order: [['createdAt', 'DESC']] })
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
    if (!freelancer.agencyId) return []
    if (await onboardingBlockReason(freelancer)) return []

    // O freelancer só vê vagas das funções que a agência marcou no perfil dele
    // E já precificou (valor/hora do colaborador para aquela função).
    const marked = await FreelancerCategory.findAll({
      where: { freelancerId: freelancer.id },
      attributes: ['categoryId', 'hourlyRate'],
    })
    const pricedCategoryIds = marked
      .filter((m) => m.hourlyRate != null && Number(m.hourlyRate) > 0)
      .map((m) => m.categoryId)
    if (!pricedCategoryIds.length) return []

    const where: any = {
      status: 'pending',
      freelancerId: null,
      categoryId: { [Op.in]: pricedCategoryIds },
    }
    const jobs = await Job.findAll({ where, include: jobIncludes, order: [['startTime', 'ASC']] })
    if (!jobs.length) return []

    // …e cujo supermercado tem valor/hora ativo para a função (específico da loja ou padrão).
    const supermarketIds = [...new Set(jobs.map((j) => j.supermarketId))]
    const rates = await SupermarketCategoryRate.findAll({
      where: { supermarketId: { [Op.in]: supermarketIds }, active: true },
    })
    const defaultPriced = new Set(
      rates.filter((r) => !r.branchId).map((r) => `${r.supermarketId}|${r.categoryId}`)
    )
    const branchPriced = new Set(
      rates.filter((r) => r.branchId).map((r) => `${r.supermarketId}|${r.categoryId}|${r.branchId}`)
    )
    const isPriced = (supermarketId: string, categoryId: string, branchId?: string | null) =>
      (branchId != null && branchPriced.has(`${supermarketId}|${categoryId}|${branchId}`)) ||
      defaultPriced.has(`${supermarketId}|${categoryId}`)

    // Filtra pelo preço da loja da vaga + não mostra vagas cujo último turno já terminou.
    const now = Date.now()
    return jobs.filter((job) => {
      if (!isPriced(job.supermarketId, job.categoryId, job.branchId)) return false
      const shifts = (job as any).shifts ?? []
      if (!shifts.length) return new Date(job.endTime).getTime() > now
      return shifts.some((s: any) => new Date(s.endTime).getTime() > now)
    })
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

  /** Vagas em andamento de um supermercado (opcionalmente de uma loja só). */
  async liveForSupermarket(supermarketId: string, branchId?: string | null) {
    const where: any = { status: 'in_progress', supermarketId }
    if (branchId) where.branchId = branchId
    return Job.findAll({ where, include: jobIncludes, order: [['startTime', 'ASC']] })
  },

  // Compat: cria uma vaga avulsa como um pedido de 1 item (turno = manha|tarde|noite|madrugada).
  async create(data: any, ctx: OrderContext) {
    const order = await orderService.create(
      {
        branchId: data.branchId,
        notes: data.notes ?? null,
        items: [
          {
            categoryId: data.categoryId,
            branchId: data.branchId,
            title: data.title,
            quantity: Number(data.quantity) > 1 ? Number(data.quantity) : 1,
            shiftPeriod: data.shiftPeriod,
            shifts: data.shifts,
            date: data.date,
            startTime: data.startTime,
            endTime: data.endTime,
          },
        ],
      },
      ctx
    )
    const firstJob = (order as any)?.orderJobs?.[0]
    return firstJob ? this.findById(firstJob.id) : order
  },

  // Edita uma vaga ainda disponível: função, turno/data e título.
  async update(id: string, data: any, supermarketId: string) {
    const job = await this.assertOwned(id, supermarketId)
    if (job.status !== 'pending') {
      throw new Error('Só é possível editar a vaga enquanto ela está disponível (sem freelancer).')
    }
    await sequelize.transaction(async (t) => {
      const patch = await applyJobEdit(job, data, t)
      await job.update(patch, { transaction: t })
    })
    return this.findById(id)
  },

  /**
   * A agência gerencia a vaga: edita função/turno/título enquanto pendente e ajusta os
   * overrides de configuração (raio, prazo, foto, avaliação) enquanto não estiver
   * concluída/cancelada. `null` num override volta ao padrão da agência.
   */
  async updateByAgency(id: string, _agencyId: string, data: any) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (['completed', 'canceled'].includes(job.status)) {
      throw new Error('Não é possível editar uma vaga concluída ou cancelada.')
    }

    await sequelize.transaction(async (t) => {
      const patch: any = {}

      for (const f of JOB_CONFIG_FIELDS) {
        if (!(f in data)) continue
        const v = data[f]
        if (v == null || v === '') {
          patch[f] = null
        } else if (f === 'requireCheckoutPhoto' || f === 'reviewEnabled') {
          patch[f] = v === true || v === 'true'
        } else {
          const n = Math.trunc(Number(v))
          if (!Number.isFinite(n) || n < 0) throw new Error('Valor de configuração inválido.')
          patch[f] = n
        }
      }

      const wantsReshape =
        data.title != null ||
        data.categoryId != null ||
        data.shifts != null ||
        data.shiftPeriod != null ||
        data.date != null
      if (wantsReshape) {
        if (job.status !== 'pending') {
          throw new Error('Função, turno e título só mudam enquanto a vaga está disponível.')
        }
        Object.assign(patch, await applyJobEdit(job, data, t))
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
    const blocked = await onboardingBlockReason(freelancer)
    if (blocked) throw new Error(blocked)
    const job = await Job.findByPk(id, { include: [{ model: JobShift, as: 'shifts' }] })
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.status !== 'pending' || job.freelancerId) {
      throw new Error('Esta vaga não está mais disponível.')
    }

    // A vaga só pode ser assumida se houver valor/hora do colaborador para a função
    // E valor/hora que o supermercado paga pela função nessa loja.
    const freelancerRate = await freelancerService.categoryRate(freelancer.id, job.categoryId)
    if (freelancerRate == null) {
      throw new Error('Sua agência ainda não definiu o seu valor/hora para esta função.')
    }
    const supermarketRate = await supermarketRateService.activeRate(
      job.supermarketId,
      job.categoryId,
      job.branchId
    )
    if (!supermarketRate) {
      throw new Error('O supermercado ainda não tem um valor/hora para esta função nesta loja.')
    }

    // Um freelancer só pode ter uma vaga por período — sem sobreposição de horário.
    const clash = await Job.findOne({
      where: {
        freelancerId: freelancer.id,
        status: { [Op.in]: ['accepted', 'in_progress'] },
        startTime: { [Op.lt]: job.endTime },
        endTime: { [Op.gt]: job.startTime },
      },
    })
    if (clash) {
      throw new Error(
        `Você já tem uma vaga aceita nesse período (${fmtWindow(clash.startTime, clash.endTime)}).`
      )
    }

    const shifts = (job as any).shifts ?? []
    const contractedMinutes = job.contractedMinutes ?? (shifts.length ? sumShiftMinutes(shifts) : null)

    await job.update({ freelancerId: freelancer.id, status: 'accepted', contractedMinutes })
    await orderService.syncStatus(job.orderId)
    return this.findById(id)
  },

  // Freelancer desiste da vaga (dentro do prazo definido pela agência). Volta a ficar disponível.
  async withdrawByFreelancer(id: string, freelancer: FreelancerInstance, reason?: string) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.freelancerId !== freelancer.id) throw new Error('Esta vaga não está atribuída a você.')
    if (job.status !== 'accepted') {
      throw new Error('Só é possível desistir de uma vaga aceita que ainda não começou.')
    }

    const agency = freelancer.agencyId ? await Agency.findByPk(freelancer.agencyId) : null
    const windowMin = job.cancellationWindowMinutes ?? agency?.cancellationWindowMinutes ?? 30
    const deadline = new Date(new Date(job.startTime).getTime() - windowMin * 60000)
    if (new Date() > deadline) {
      throw new Error(
        `Fora do prazo de cancelamento (até ${windowMin} min antes do início). Solicite o cancelamento à sua agência.`
      )
    }

    await sequelize.transaction(async (t) => {
      await JobLog.create(
        {
          jobId: id,
          freelancerId: freelancer.id,
          eventType: 'withdrawn',
          reason: reason?.trim() || 'Freelancer desistiu da vaga.',
          timestamp: new Date(),
        },
        { transaction: t }
      )
      await JobShift.update(
        { status: 'pending', checkInAt: null, checkOutAt: null, workedMinutes: null },
        { where: { jobId: id }, transaction: t }
      )
      await job.update({ freelancerId: null, status: 'pending' }, { transaction: t })
    })

    await orderService.syncStatus(job.orderId)
    return this.findById(id)
  },

  // A agência libera a vaga de um freelancer da sua rede (para repassar / reabrir).
  async releaseByAgency(id: string, agencyId: string, reason?: string) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (!['accepted', 'in_progress'].includes(job.status)) {
      throw new Error('Só é possível liberar uma vaga aceita ou em andamento.')
    }
    const freelancer = job.freelancerId ? await Freelancer.findByPk(job.freelancerId) : null
    if (!freelancer || freelancer.agencyId !== agencyId) {
      throw new Error('Este freelancer não pertence à sua agência.')
    }
    await cancelJobByAgency(job, freelancer.id, 'withdrawn', reason?.trim() || 'Vaga liberada pela agência.')
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
    await freelancer.update({ blockedUntil })

    await cancelJobByAgency(job, freelancer.id, 'no-show', reason.trim())
    return this.findById(id)
  },

  /** Vagas concluídas da rede da agência com pagamento retido (hora extra acima da tolerância). */
  async pendingSettlementForAgency(agencyId: string) {
    const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id'] })
    const ids = freelancers.map((f) => f.id)
    if (!ids.length) return []
    return Job.findAll({
      where: { settlementHold: true, freelancerId: { [Op.in]: ids } },
      include: jobIncludes,
      order: [['completedAt', 'ASC']],
    })
  },

  /**
   * A agência libera o pagamento de uma vaga retida por hora extra.
   * `capToContracted` = paga/cobra só o tempo contratado (ignora o excedente).
   */
  async releasePayment(id: string, agencyId: string, capToContracted = false) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (!job.settlementHold) {
      throw new Error('Esta vaga não está aguardando liberação de pagamento.')
    }
    const freelancer = job.freelancerId ? await Freelancer.findByPk(job.freelancerId) : null
    if (!freelancer || freelancer.agencyId !== agencyId) {
      throw new Error('Este colaborador não pertence à sua agência.')
    }

    const patch: any = { settlementApprovedAt: new Date() }
    if (capToContracted && job.contractedMinutes != null) {
      patch.workedMinutes = Math.min(job.workedMinutes ?? 0, job.contractedMinutes)
    }
    await job.update(patch)
    await paymentService.settleForJob(await job.reload())
    return this.findById(id)
  },

  async assertOwned(id: string, supermarketId: string) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.supermarketId !== supermarketId) throw new Error('Vaga não pertence ao seu supermercado.')
    return job
  },
}
