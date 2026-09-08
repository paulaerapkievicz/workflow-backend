import { Op, Transaction } from 'sequelize'
import { sequelize } from '../database'
import { Job } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { JobShiftBreak } from '../models/JobShiftBreak'
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
import { Invoice } from '../models/Invoice'
import { FreelancerContract } from '../models/FreelancerContract'
import { UserInstance } from '../models/User'
import { Agency } from '../models/Agency'
import { SupermarketCategoryRate } from '../models/SupermarketCategoryRate'
import { profileService } from './profileService'
import { AgencyActor, assertBranchInScope, assertFreelancerInScope } from '../helpers/agencyScope'
import { orderService, OrderContext } from './orderService'
import { supermarketRateService } from './supermarketRateService'
import { freelancerService } from './freelancerService'
import { paymentService } from './paymentService'
import { minutesBetween, CHECKOUT_OVERTIME_TOLERANCE_MINUTES } from '../helpers/time'
import { resolveShifts } from '../helpers/shifts'
import { jobLogService, resolveBreaksEnabled, sumClosedBreakMinutes } from './jobLogService'

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
  { model: JobShift, as: 'shifts', include: [{ model: JobShiftBreak, as: 'breaks' }] },
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
 * O colaborador não pode ter outra vaga aceita/em andamento sobrepondo a janela `[start, end]`.
 * Mesma regra usada no aceite normal, na troca de colaborador e na remarcação pela agência.
 */
async function assertNoScheduleClash(
  freelancerId: string,
  start: Date | string,
  end: Date | string,
  opts: { exceptJobId?: string; subject?: string } = {}
) {
  const where: any = {
    freelancerId,
    status: { [Op.in]: ['accepted', 'in_progress'] },
    startTime: { [Op.lt]: end },
    endTime: { [Op.gt]: start },
  }
  if (opts.exceptJobId) where.id = { [Op.ne]: opts.exceptJobId }
  const clash = await Job.findOne({ where })
  if (clash) {
    throw new Error(
      `${opts.subject ?? 'O colaborador'} já tem uma vaga aceita nesse período (${fmtWindow(clash.startTime, clash.endTime)}).`
    )
  }
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
  'breaksEnabled',
  'breakLimitMinutes',
] as const

const JOB_CONFIG_BOOLEAN_FIELDS = ['requireCheckoutPhoto', 'reviewEnabled', 'breaksEnabled']

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
    const rate = await supermarketRateService.activeRate(job.supermarketId, category.id, job.branchId)
    if (!rate) {
      throw new Error(
        `A função "${category.name}" ainda não tem valor/hora configurado para esta loja. Peça para a agência configurar em Supermercados → Valores/hora antes de trocar a função da vaga.`
      )
    }
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
        {
          jobId: job.id,
          position,
          startTime: s.startTime,
          endTime: s.endTime,
          label: s.label,
          nominalPeriod: s.shiftPeriod,
        },
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
  let spunOffJobId: string | null = null

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
          {
            jobId: newJob.id,
            position,
            startTime: s.startTime,
            endTime: s.endTime,
            label: s.label,
            nominalPeriod: (s as any).nominalPeriod ?? null,
          },
          { transaction: t }
        )
      }
      spunOffJobId = newJob.id
    }
  })

  // Liquida o que foi efetivamente trabalhado (settleForJob abre a própria transação).
  await paymentService.settleForJob(await job.reload())
  await orderService.syncStatus(job.orderId)
  return spunOffJobId
}

export const jobService = {
  async findById(id: string) {
    return Job.findByPk(id, { include: jobIncludes })
  },

  /**
   * Mesma vaga que `findById`, mas só devolve se o usuário tiver permissão de vê-la —
   * mesmas regras de escopo por papel de `listForUser`, aplicadas a um único registro.
   */
  async findByIdForUser(id: string, user: UserInstance) {
    const job = await this.findById(id)
    if (!job) return null
    if (user.role === 'admin') return job

    if (user.role === 'supermarket') {
      const ctx = await profileService.supermarketContextForUser(user)
      if (!ctx || job.supermarketId !== ctx.supermarketId) return null
      if (ctx.branchId && job.branchId !== ctx.branchId) return null
      return job
    }

    if (user.role === 'freelancer') {
      const freelancer = await profileService.freelancerForUser(user)
      if (!freelancer) return null
      if (job.freelancerId === freelancer.id) return job
      if (job.status === 'pending' && !job.freelancerId) return job
      return null
    }

    if (user.role === 'agency' || user.role === 'leader') {
      const actor = await profileService.agencyContextForUser(user)
      if (!actor) return null
      if ((job as any).jobSupermarket?.agencyId !== actor.agencyId) return null
      // Líder com escopo de filiais só enxerga vagas das filiais do escopo.
      if (actor.scopeBranchIds && !actor.scopeBranchIds.includes(job.branchId)) return null
      return job
    }

    return null
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
      // Vagas do freelancer + pool aberto — mas só dentro da própria agência: o supermercado
      // da vaga precisa ser cliente da agência do freelancer.
      return Job.findAll({
        where: {
          [Op.or]: [
            { freelancerId: freelancer.id },
            { status: 'pending', freelancerId: null, '$jobSupermarket.agency_id$': freelancer.agencyId },
          ],
        },
        include: jobIncludes,
        order: [['startTime', 'ASC']],
      })
    }

    if (user.role === 'agency' || user.role === 'leader') {
      const actor = await profileService.agencyContextForUser(user)
      if (!actor) return []
      // A agência só vê vagas de supermercados que são clientes dela — sem pool entre agências.
      const where: any = { '$jobSupermarket.agency_id$': actor.agencyId }
      if (actor.scopeBranchIds) where.branchId = { [Op.in]: actor.scopeBranchIds }
      return Job.findAll({ where, include: jobIncludes, order: [['createdAt', 'DESC']] })
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
    // O supermercado da vaga precisa ser cliente da MESMA agência do freelancer — não existe
    // pool aberto entre agências.
    const now = Date.now()
    return jobs.filter((job) => {
      if ((job as any).jobSupermarket?.agencyId !== freelancer.agencyId) return false
      if (!isPriced(job.supermarketId, job.categoryId, job.branchId)) return false
      const shifts = (job as any).shifts ?? []
      if (!shifts.length) return new Date(job.endTime).getTime() > now
      return shifts.some((s: any) => new Date(s.endTime).getTime() > now)
    })
  },

  /** Vagas em andamento da rede da agência, com o último ponto de localização. */
  async liveForAgency(agencyId: string, actor?: AgencyActor | null) {
    const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id'] })
    const ids = freelancers.map((f) => f.id)
    if (!ids.length) return []
    const where: any = { status: 'in_progress', freelancerId: { [Op.in]: ids } }
    if (actor?.scopeBranchIds) where.branchId = { [Op.in]: actor.scopeBranchIds }
    return Job.findAll({ where, include: jobIncludes, order: [['startTime', 'ASC']] })
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
  async updateByAgency(id: string, _agencyId: string, data: any, actor?: AgencyActor | null) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (actor) assertBranchInScope(actor, job.branchId)
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
        } else if (JOB_CONFIG_BOOLEAN_FIELDS.includes(f)) {
          patch[f] = v === true || v === 'true'
        } else {
          const n = Math.trunc(Number(v))
          if (!Number.isFinite(n) || n < 0) throw new Error('Valor de configuração inválido.')
          patch[f] = n
        }
      }

      const wantsFunctionChange = data.title != null || data.categoryId != null
      const wantsReshape =
        wantsFunctionChange ||
        data.shifts != null ||
        data.shiftPeriod != null ||
        data.date != null
      if (wantsReshape) {
        // Função/título só mudam enquanto a vaga está disponível. Turno/data também podem
        // ser remarcados numa vaga já aceita (nenhum turno começou) — nesse caso revalida
        // o conflito de agenda do colaborador alocado.
        if (wantsFunctionChange && job.status !== 'pending') {
          throw new Error('Função e título só mudam enquanto a vaga está disponível.')
        }
        if (job.status === 'in_progress') {
          throw new Error(
            'A vaga já está em andamento — use "Corrigir horário e ponto" para ajustar turnos e marcações.'
          )
        }
        Object.assign(patch, await applyJobEdit(job, data, t))
        if (job.status === 'accepted' && job.freelancerId && patch.startTime && patch.endTime) {
          await assertNoScheduleClash(job.freelancerId, patch.startTime, patch.endTime, {
            exceptJobId: job.id,
          })
        }
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
    const job = await Job.findByPk(id, {
      include: [
        { model: JobShift, as: 'shifts' },
        { model: Supermarket, as: 'jobSupermarket' },
      ],
    })
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.status !== 'pending' || job.freelancerId) {
      throw new Error('Esta vaga não está mais disponível.')
    }
    if ((job as any).jobSupermarket?.agencyId !== freelancer.agencyId) {
      throw new Error('Esta vaga não pertence à sua agência.')
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
    await assertNoScheduleClash(freelancer.id, job.startTime, job.endTime, { subject: 'Você' })

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

    // Desistência no meio do trabalho: fecha o turno atual com as horas já feitas (liquidadas
    // pro colaborador que sai) e devolve o restante da vaga pro pool `pending`.
    if (job.status === 'in_progress') {
      return this.giveUpInProgressByFreelancer(job, freelancer, reason)
    }

    if (job.status !== 'accepted') {
      throw new Error('Só é possível desistir de uma vaga aceita ou de uma vaga em andamento.')
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

  /**
   * Desistência do colaborador com a vaga já `in_progress`. Fecha o turno em andamento
   * computando as horas efetivamente trabalhadas (descontadas as pausas) — liquidadas pra
   * quem sai — e, se ainda resta tempo do turno, empacota esse restante + os turnos não
   * iniciados numa vaga `pending` nova, disponível pra outro colaborador terminar.
   * Reaproveita o mesmo mecanismo de trabalho parcial de `cancelJobByAgency`.
   */
  async giveUpInProgressByFreelancer(job: any, freelancer: FreelancerInstance, reason?: string) {
    const now = new Date()
    const openShift = await JobShift.findOne({ where: { jobId: job.id, status: 'in_progress' } })

    if (openShift && openShift.checkInAt) {
      await JobShiftBreak.update({ endAt: now }, { where: { jobShiftId: openShift.id, endAt: null } })
      const breakMinutes = await sumClosedBreakMinutes(openShift.id)
      const workedMinutes = Math.max(0, minutesBetween(openShift.checkInAt, now) - breakMinutes)

      if (workedMinutes > 0) {
        await openShift.update({ status: 'done', checkOutAt: now, workedMinutes })
        // O que sobra do turno atual vira um turno pendente pra próxima pessoa.
        const remainingMinutes = minutesBetween(now, openShift.endTime)
        if (remainingMinutes >= 15) {
          await JobShift.create({
            jobId: job.id,
            position: openShift.position,
            startTime: now,
            endTime: openShift.endTime,
            label: openShift.label,
            nominalPeriod: (openShift as any).nominalPeriod ?? null,
          })
        }
      }
    }

    await cancelJobByAgency(
      job,
      freelancer.id,
      'withdrawn',
      reason?.trim() || 'Colaborador desistiu da vaga em andamento.'
    )
    return this.findById(job.id)
  },

  // A agência libera a vaga de um freelancer da sua rede (para repassar / reabrir).
  async releaseByAgency(id: string, agencyId: string, reason?: string, actor?: AgencyActor | null) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (actor) assertBranchInScope(actor, job.branchId)
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
  async registerNoShow(id: string, agencyId: string, reason: string, actor?: AgencyActor | null) {
    if (!reason || !reason.trim()) throw new Error('Informe o motivo da falta.')
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (actor) assertBranchInScope(actor, job.branchId)
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

  /**
   * Checkout forçado pela agência — mesma lógica de `jobLogService.checkOut` (fecha o turno
   * aberto, calcula minutos trabalhados, liquida ou retém por hora extra), mas sem os gates de
   * geofence/foto que só fazem sentido pro próprio freelancer batendo o ponto.
   */
  async forceCheckoutByAgency(id: string, agencyId: string, reason: string, actor?: AgencyActor | null) {
    if (!reason || !reason.trim()) throw new Error('Informe o motivo do checkout forçado.')
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (actor) assertBranchInScope(actor, job.branchId)
    if (job.status !== 'in_progress') {
      throw new Error('Só é possível forçar o checkout de uma vaga em andamento.')
    }
    const freelancer = job.freelancerId ? await Freelancer.findByPk(job.freelancerId) : null
    if (!freelancer || freelancer.agencyId !== agencyId) {
      throw new Error('Este freelancer não pertence à sua agência.')
    }
    const shift = await JobShift.findOne({ where: { jobId: id, status: 'in_progress' } })
    if (!shift) throw new Error('Nenhum turno em andamento para encerrar.')

    const now = new Date()
    // Fecha uma pausa que tenha ficado aberta (a agência está forçando o encerramento).
    await JobShiftBreak.update(
      { endAt: now },
      { where: { jobShiftId: shift.id, endAt: null } }
    )
    const breakMinutes = await sumClosedBreakMinutes(shift.id)
    const workedMinutes = shift.checkInAt
      ? Math.max(0, minutesBetween(shift.checkInAt, now) - breakMinutes)
      : 0

    await JobLog.create({
      jobId: id,
      freelancerId: freelancer.id,
      jobShiftId: shift.id,
      eventType: 'forced-checkout',
      timestamp: now,
      reason: reason.trim(),
    })
    await shift.update({ status: 'done', checkOutAt: now, workedMinutes })

    const shifts = await JobShift.findAll({ where: { jobId: id } })
    let settlementHeld = false
    if (shifts.every((s) => ['done', 'missed'].includes(s.status))) {
      const totalWorked = shifts.reduce((acc, s) => acc + (s.workedMinutes ?? 0), 0)
      const contracted = job.contractedMinutes ?? 0
      settlementHeld = contracted > 0 && totalWorked > contracted + CHECKOUT_OVERTIME_TOLERANCE_MINUTES
      await job.update({
        status: 'completed',
        workedMinutes: totalWorked,
        completedAt: now,
        settlementHold: settlementHeld,
      })
      if (!settlementHeld) await paymentService.settleForJob(await job.reload())
      await orderService.syncStatus(job.orderId)
    }
    return this.findById(id)
  },

  /** A agência registra uma pausa/intervalo no lugar do colaborador (recurso precisa estar habilitado). */
  async breakByAgency(id: string, agencyId: string, action: 'start' | 'end', actor?: AgencyActor | null) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (actor) assertBranchInScope(actor, job.branchId)
    const freelancer = job.freelancerId ? await Freelancer.findByPk(job.freelancerId) : null
    if (!freelancer || freelancer.agencyId !== agencyId) {
      throw new Error('Este colaborador não pertence à sua agência.')
    }
    return action === 'start'
      ? jobLogService.openBreak(id, freelancer, 'agency')
      : jobLogService.closeBreak(id, freelancer, 'agency')
  },

  /**
   * A agência corrige o horário e o ponto de uma vaga (erro de lançamento ou de marcação).
   * - turno ainda `pending`: pode remarcar `startTime`/`endTime`.
   * - turno `in_progress`/`done`: pode ajustar `checkInAt`/`checkOutAt` e substituir as pausas.
   * Recalcula janela da vaga, minutos contratados e trabalhados; se a vaga já estiver liquidada,
   * reajusta o `Payment` e os saldos. Bloqueado se a vaga já entrou num fechamento mensal pago.
   */
  async correctTimesheetByAgency(
    id: string,
    agencyId: string,
    payload: {
      shifts?: {
        shiftId: string
        startTime?: string | null
        endTime?: string | null
        checkInAt?: string | null
        checkOutAt?: string | null
        breaks?: { startAt: string; endAt: string }[]
      }[]
      reason?: string
    },
    actor?: AgencyActor | null
  ) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (actor) assertBranchInScope(actor, job.branchId)
    if (['pending', 'awaiting_approval', 'canceled'].includes(job.status)) {
      throw new Error('Só é possível corrigir o ponto de uma vaga aceita, em andamento ou concluída.')
    }
    const freelancer = job.freelancerId ? await Freelancer.findByPk(job.freelancerId) : null
    if (!freelancer || freelancer.agencyId !== agencyId) {
      throw new Error('Este colaborador não pertence à sua agência.')
    }
    if (job.monthlyInvoiceId) {
      const inv = await Invoice.findByPk(job.monthlyInvoiceId)
      if (inv && inv.status !== 'pending') {
        throw new Error(
          'Esta vaga já foi faturada num fechamento mensal — a correção precisa ser feita pelo fechamento.'
        )
      }
    }

    const patches = payload?.shifts ?? []
    if (!patches.length) throw new Error('Informe ao menos um turno para corrigir.')

    const shifts = await JobShift.findAll({ where: { jobId: id }, order: [['position', 'ASC']] })
    const byId = new Map(shifts.map((s) => [s.id, s]))
    const parseDate = (v: unknown, field: string) => {
      const d = new Date(String(v))
      if (Number.isNaN(d.getTime())) throw new Error(`Data/hora inválida em ${field}.`)
      return d
    }

    const before = shifts.map((s) => `${s.label}: ${fmtWindow(s.startTime, s.endTime)}`).join(' | ')

    await sequelize.transaction(async (t) => {
      for (const p of patches) {
        const shift = byId.get(p.shiftId)
        if (!shift) throw new Error('Turno não encontrado nesta vaga.')

        if (shift.status === 'pending') {
          const start = p.startTime != null ? parseDate(p.startTime, 'início do turno') : shift.startTime
          const end = p.endTime != null ? parseDate(p.endTime, 'fim do turno') : shift.endTime
          if (new Date(end).getTime() <= new Date(start).getTime()) {
            throw new Error('O fim do turno precisa ser depois do início.')
          }
          await shift.update({ startTime: start, endTime: end }, { transaction: t })
        } else {
          // turno iniciado (in_progress/done/missed) — corrige a marcação de ponto
          const checkInAt = p.checkInAt != null ? parseDate(p.checkInAt, 'check-in') : shift.checkInAt
          const checkOutAt =
            p.checkOutAt != null ? parseDate(p.checkOutAt, 'check-out') : shift.checkOutAt

          if (p.breaks) {
            await JobShiftBreak.destroy({ where: { jobShiftId: shift.id }, transaction: t })
            for (const b of p.breaks) {
              const bs = parseDate(b.startAt, 'início da pausa')
              const be = parseDate(b.endAt, 'fim da pausa')
              if (be.getTime() <= bs.getTime()) throw new Error('O fim da pausa precisa ser depois do início.')
              await JobShiftBreak.create(
                {
                  jobShiftId: shift.id,
                  jobId: id,
                  freelancerId: freelancer.id,
                  startAt: bs,
                  endAt: be,
                  startedBy: 'agency',
                },
                { transaction: t }
              )
            }
          }

          const patch: any = { checkInAt, checkOutAt }
          if (checkInAt && checkOutAt) {
            const breakMin = await sumClosedBreakMinutes(shift.id)
            patch.workedMinutes = Math.max(0, minutesBetween(checkInAt, checkOutAt) - breakMin)
            if (shift.status === 'in_progress') patch.status = 'done'
          }
          await shift.update(patch, { transaction: t })
        }
      }

      // Recalcula a janela e os minutos contratados da vaga a partir dos turnos.
      const fresh = await JobShift.findAll({ where: { jobId: id }, order: [['position', 'ASC']], transaction: t })
      const jobPatch: any = {
        startTime: fresh[0].startTime,
        endTime: fresh[fresh.length - 1].endTime,
        contractedMinutes: sumShiftMinutes(fresh),
      }
      if (job.status === 'completed' && fresh.every((s) => ['done', 'missed'].includes(s.status))) {
        const totalWorked = fresh.reduce((acc, s) => acc + (s.workedMinutes ?? 0), 0)
        jobPatch.workedMinutes = totalWorked
        const contracted = jobPatch.contractedMinutes ?? 0
        const overtime = contracted > 0 && totalWorked > contracted + CHECKOUT_OVERTIME_TOLERANCE_MINUTES
        // A trava de hora extra só vale antes de liquidar; se já pagou, mantém liberado.
        const alreadyPaid = await Payment.findOne({ where: { jobId: id }, transaction: t })
        jobPatch.settlementHold = alreadyPaid ? false : overtime
      }
      await job.update(jobPatch, { transaction: t })

      await JobLog.create(
        {
          jobId: id,
          freelancerId: freelancer.id,
          eventType: 'forced-checkout',
          timestamp: new Date(),
          reason: `Correção de horário/ponto pela agência. Antes — ${before}. Motivo: ${
            payload?.reason?.trim() || 'não informado'
          }.`,
        },
        { transaction: t }
      )
    })

    // Fora da transação: (re)liquidação conforme o estado da vaga.
    const reloaded = await Job.findByPk(id)
    if (reloaded && reloaded.status === 'completed') {
      const payment = await Payment.findOne({ where: { jobId: id } })
      if (payment) {
        await paymentService.resettleForJob(reloaded)
      } else if (!reloaded.settlementHold) {
        await paymentService.settleForJob(reloaded)
      }
    }
    await orderService.syncStatus(job.orderId)
    return this.findById(id)
  },

  /**
   * Troca o freelancer da vaga. Sem turno iniciado: solta o atual e já atribui o novo
   * diretamente. Com turno em andamento/concluído: usa o mesmo mecanismo de "trabalho parcial"
   * de `cancelJobByAgency` (fecha a vaga original com as horas do freelancer atual liquidadas e
   * cria uma vaga nova `pending` com o restante) e atribui o novo freelancer a essa vaga nova.
   */
  async reassignByAgency(
    id: string,
    agencyId: string,
    newFreelancerId: string,
    reason?: string,
    actor?: AgencyActor | null
  ) {
    const job = await Job.findByPk(id)
    if (!job) throw new Error('Vaga não encontrada.')
    if (actor) {
      assertBranchInScope(actor, job.branchId)
      assertFreelancerInScope(actor, newFreelancerId)
    }
    if (!['accepted', 'in_progress'].includes(job.status)) {
      throw new Error('Só é possível trocar o colaborador de uma vaga aceita ou em andamento.')
    }
    const currentFreelancer = job.freelancerId ? await Freelancer.findByPk(job.freelancerId) : null
    if (!currentFreelancer || currentFreelancer.agencyId !== agencyId) {
      throw new Error('Este freelancer não pertence à sua agência.')
    }
    const newFreelancer = await Freelancer.findByPk(newFreelancerId)
    if (!newFreelancer || newFreelancer.agencyId !== agencyId) {
      throw new Error('O novo colaborador precisa ser da sua agência.')
    }
    if (newFreelancer.id === currentFreelancer.id) {
      throw new Error('Escolha um colaborador diferente do atual.')
    }
    if (newFreelancer.blockedUntil && new Date(newFreelancer.blockedUntil) > new Date()) {
      throw new Error('O novo colaborador está temporariamente bloqueado.')
    }
    // O novo colaborador precisa ter valor/hora definido para a função da vaga —
    // sem isso a vaga não pode ser liquidada no fim (mesma regra do aceite normal).
    const newFreelancerRate = await freelancerService.categoryRate(newFreelancer.id, job.categoryId)
    if (newFreelancerRate == null) {
      throw new Error(
        'O novo colaborador não tem valor/hora definido para a função desta vaga. ' +
          'Defina o valor/hora dele nessa função (em Colaboradores) antes de trocar.'
      )
    }

    const shifts = await JobShift.findAll({ where: { jobId: id } })
    const hasWorkedShift = shifts.some((s) => s.status === 'done' && (s.workedMinutes ?? 0) > 0)

    // O novo colaborador não pode já ter outra vaga aceita/em andamento no mesmo horário —
    // mesma regra de não-sobreposição que vale pra um aceite normal (`accept`).
    const noClash = (start: Date | string, end: Date | string) =>
      assertNoScheduleClash(newFreelancer.id, start, end, { subject: 'O novo colaborador' })

    if (!hasWorkedShift) {
      // Nada foi trabalhado ainda — troca direta, sem gerar vaga nova.
      await noClash(job.startTime, job.endTime)
      await sequelize.transaction(async (t) => {
        await JobLog.create(
          {
            jobId: id,
            freelancerId: currentFreelancer.id,
            eventType: 'withdrawn',
            reason: reason?.trim() || `Trocado pela agência por ${newFreelancer.name}.`,
            timestamp: new Date(),
          },
          { transaction: t }
        )
        await JobShift.update(
          { status: 'pending', checkInAt: null, checkOutAt: null, workedMinutes: null },
          { where: { jobId: id }, transaction: t }
        )
        await job.update({ freelancerId: newFreelancer.id, status: 'accepted' }, { transaction: t })
      })
      await orderService.syncStatus(job.orderId)
      return this.findById(id)
    }

    // Já tem trabalho feito — o restante vira uma vaga nova pro novo colaborador, então a
    // checagem de conflito é contra a janela do que sobrou, não a vaga inteira.
    const remainingShifts = shifts.filter((s) => s.status !== 'done')
    if (remainingShifts.length) {
      await noClash(
        remainingShifts[0].startTime,
        remainingShifts[remainingShifts.length - 1].endTime
      )
    }

    // Fecha a vaga original (liquidando o freelancer atual) e o restante vira uma vaga nova,
    // que atribuímos direto ao novo colaborador.
    const spunOffJobId = await cancelJobByAgency(
      job,
      currentFreelancer.id,
      'withdrawn',
      reason?.trim() || `Trocado pela agência por ${newFreelancer.name}.`
    )
    if (spunOffJobId) {
      const remainder = await Job.findByPk(spunOffJobId)
      if (remainder) {
        await remainder.update({ freelancerId: newFreelancer.id, status: 'accepted' })
        await orderService.syncStatus(remainder.orderId)
      }
      return this.findById(spunOffJobId)
    }
    // Turno único, já totalmente concluído: não sobrou nada pra reatribuir.
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

  // Dados do colaborador alocado na vaga — só o essencial pro supermercado identificar quem vai atender.
  async freelancerProfileForSupermarket(id: string, supermarketId: string) {
    const job = await this.assertOwned(id, supermarketId)
    if (!job.freelancerId) throw new Error('Esta vaga ainda não tem um colaborador aceito.')
    const freelancer = await Freelancer.findByPk(job.freelancerId)
    if (!freelancer) throw new Error('Colaborador não encontrado.')
    return {
      name: freelancer.name,
      phone: freelancer.phone ?? null,
      document: freelancer.document ?? null,
      profilePhotoUrl: freelancer.profilePhotoUrl ?? null,
    }
  },
}
