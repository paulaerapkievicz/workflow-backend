// src/services/jobAlertService.ts
//
// Motor do controle de ocorrências das vagas. Centraliza `raise` / `resolve` (idempotentes por
// `dedupeKey`) e a varredura periódica `sweep`. É chamado de:
//  - hooks nos serviços de ponto/vaga/pagamento (consequência de uma ação);
//  - `sweep()` agendado no server (ausência de ação: ninguém bateu ponto, ninguém aceitou…).

import { Op, Transaction } from 'sequelize'
import { JobAlert, JobAlertInstance, JobAlertContext } from '../models/JobAlert'
import { Job } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { JobShiftBreak } from '../models/JobShiftBreak'
import { Freelancer } from '../models/Freelancer'
import { Branch } from '../models/Branch'
import { Supermarket } from '../models/Supermarket'
import { Agency } from '../models/Agency'
import { Category } from '../models/Category'
import { AgencyActor, inBranchScope, inFreelancerScope } from '../helpers/agencyScope'
import { SupermarketContext } from './profileService'
import { minutesBetween } from '../helpers/time'
import { resolveBreakLimitMinutes, sumClosedBreakMinutes } from './jobLogService'
import {
  ALERT_CATALOG,
  AlertResolutionCode,
  AlertSeverity,
  AlertStatus,
  JobAlertType,
  SEVERITY_RANK,
  SWEEPER_OWNED_TYPES,
  UNFILLED_URGENT_MINUTES,
  BREAK_OPEN_ALERT_MINUTES,
  MISSING_CHECKOUT_CRITICAL_MINUTES,
  alertDedupeKey,
  audienceFor,
  resolveAlertSettings,
  AlertSettings,
} from '../helpers/alerts'

const BR_TZ = 'America/Sao_Paulo'
const hm = (d: Date | string) =>
  new Date(d).toLocaleTimeString('pt-BR', { timeZone: BR_TZ, hour: '2-digit', minute: '2-digit' })
const dm = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { timeZone: BR_TZ, day: '2-digit', month: '2-digit' })
const minLabel = (n: number) => (n === 1 ? '1 minuto' : `${n} minutos`)

interface RaiseParams {
  jobId: string
  jobShiftId?: string | null
  freelancerId?: string | null
  type: JobAlertType
  /** Sobrescreve a severidade base do catálogo (tier). */
  severity?: AlertSeverity
  title: string
  message: string
  context?: JobAlertContext
  /** Config de alerta da agência (o chamador resolve uma vez). */
  settings: AlertSettings
}

interface ResolveOpts {
  by?: 'system' | 'agency' | 'leader'
  userId?: string | null
  code?: AlertResolutionCode
  note?: string | null
  transaction?: Transaction
}

function activeStatuses(): AlertStatus[] {
  return ['open', 'acknowledged']
}

/** Turno "âncora" de uma vaga (o primeiro pela janela) e o fim do último turno. */
function shiftWindow(job: any) {
  const shifts: any[] = job.shifts ?? []
  if (!shifts.length) {
    return { firstStart: new Date(job.startTime), lastEnd: new Date(job.endTime), shifts: [] }
  }
  const sorted = [...shifts].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )
  const lastEnd = sorted.reduce(
    (acc, s) => (new Date(s.endTime).getTime() > acc.getTime() ? new Date(s.endTime) : acc),
    new Date(sorted[0].endTime)
  )
  return { firstStart: new Date(sorted[0].startTime), lastEnd, shifts: sorted }
}

export const jobAlertService = {
  /**
   * Abre ou escala uma ocorrência (idempotente pela `dedupeKey`).
   * - sem linha              -> cria `open`
   * - linha já resolvida     -> não ressuscita (ocorrência nova = turno novo = chave nova)
   * - linha ativa + escalou  -> sobe a severidade, re-abre se estava só "reconhecida"
   * - linha ativa sem escalar-> atualiza texto/contexto
   */
  async raise(p: RaiseParams, opts: { transaction?: Transaction } = {}): Promise<JobAlertInstance | null> {
    if (!p.settings.alertsEnabled) return null
    const dedupeKey = alertDedupeKey(p.jobId, p.jobShiftId, p.type)
    const severity = p.severity ?? ALERT_CATALOG[p.type].baseSeverity
    const audience = audienceFor(p.type, p.settings)
    const now = new Date()
    const t = opts.transaction

    const existing = await JobAlert.findOne({ where: { dedupeKey }, transaction: t })
    if (existing) {
      if (existing.status === 'resolved') return existing
      const escalated = SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity as AlertSeverity]
      const patch: any = { title: p.title, message: p.message, audience }
      const context: JobAlertContext = { ...(existing.context ?? {}), ...(p.context ?? {}) }
      if (escalated) {
        context.escalations = [
          ...(existing.context?.escalations ?? []),
          { tier: severity, at: now.toISOString() },
        ]
        patch.severity = severity
        if (existing.status === 'acknowledged' && severity === 'critical') patch.status = 'open'
      }
      patch.context = context
      await existing.update(patch, { transaction: t })
      return existing
    }

    try {
      return await JobAlert.create(
        {
          jobId: p.jobId,
          jobShiftId: p.jobShiftId ?? null,
          freelancerId: p.freelancerId ?? null,
          type: p.type,
          severity,
          status: 'open',
          title: p.title,
          message: p.message,
          context: p.context ?? {},
          audience,
          dedupeKey,
          detectedAt: now,
        },
        { transaction: t }
      )
    } catch (err) {
      // corrida na unique — outra chamada criou a linha; recarrega e segue.
      const again = await JobAlert.findOne({ where: { dedupeKey }, transaction: t })
      if (again) return again
      throw err
    }
  },

  /** Registra a ocorrência já resolvida (ex.: o colaborador finalmente bateu o ponto atrasado). */
  async recordResolved(
    p: RaiseParams,
    resolution: { code: AlertResolutionCode; by?: 'system' | 'agency' | 'leader'; note?: string | null },
    opts: { transaction?: Transaction } = {}
  ) {
    const alert = await this.raise(p, opts)
    if (!alert || alert.status === 'resolved') return alert
    await alert.update(
      {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: resolution.by ?? 'system',
        resolutionCode: resolution.code,
        resolutionNote: resolution.note ?? null,
      },
      { transaction: opts.transaction }
    )
    return alert
  },

  /** Resolve (se ativa) a ocorrência de uma chave. No-op se não existir ou já estiver resolvida. */
  async resolveByKey(dedupeKey: string, opts: ResolveOpts = {}) {
    const alert = await JobAlert.findOne({ where: { dedupeKey }, transaction: opts.transaction })
    if (!alert || alert.status === 'resolved') return
    await alert.update(
      {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: opts.by ?? 'system',
        resolvedByUserId: opts.userId ?? null,
        resolutionCode: opts.code ?? 'auto',
        resolutionNote: opts.note ?? null,
      },
      { transaction: opts.transaction }
    )
  },

  /** Resolve todas as ocorrências ativas de certos tipos numa vaga (ex.: troca de colaborador). */
  async resolveForJob(jobId: string, types: JobAlertType[], opts: ResolveOpts = {}) {
    const alerts = await JobAlert.findAll({
      where: { jobId, type: { [Op.in]: types }, status: { [Op.in]: activeStatuses() } },
      transaction: opts.transaction,
    })
    for (const a of alerts) {
      await a.update(
        {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: opts.by ?? 'system',
          resolvedByUserId: opts.userId ?? null,
          resolutionCode: opts.code ?? 'auto',
          resolutionNote: opts.note ?? null,
        },
        { transaction: opts.transaction }
      )
    }
  },

  // ————————————————————————————————————————————————————————————————
  // Leitura / ações da agência e do supermercado
  // ————————————————————————————————————————————————————————————————

  serialize(a: any) {
    const job = a.alertJob
    return {
      id: a.id,
      jobId: a.jobId,
      jobShiftId: a.jobShiftId ?? null,
      freelancerId: a.freelancerId ?? null,
      type: a.type,
      typeLabel: ALERT_CATALOG[a.type as JobAlertType]?.label ?? a.type,
      resolutionHint: ALERT_CATALOG[a.type as JobAlertType]?.resolutionHint ?? '',
      severity: a.severity,
      status: a.status,
      title: a.title,
      message: a.message,
      context: a.context ?? {},
      audience: a.audience ?? [],
      detectedAt: a.detectedAt,
      acknowledgedAt: a.acknowledgedAt ?? null,
      resolvedAt: a.resolvedAt ?? null,
      resolvedBy: a.resolvedBy ?? null,
      resolutionCode: a.resolutionCode ?? null,
      resolutionNote: a.resolutionNote ?? null,
      job: job
        ? {
            id: job.id,
            title: job.title,
            status: job.status,
            startTime: job.startTime,
            endTime: job.endTime,
            branchId: job.branchId,
            branchName: job.jobBranch?.name ?? null,
          }
        : null,
      freelancer: a.alertFreelancer
        ? {
            id: a.alertFreelancer.id,
            name: a.alertFreelancer.name,
            phone: a.alertFreelancer.phone ?? null,
            profilePhotoUrl: a.alertFreelancer.profilePhotoUrl ?? null,
          }
        : null,
      shift: a.alertShift
        ? {
            id: a.alertShift.id,
            startTime: a.alertShift.startTime,
            endTime: a.alertShift.endTime,
            position: a.alertShift.position,
          }
        : null,
    }
  },

  buildFilters(query: Record<string, unknown>) {
    const where: any = {}
    const status = String(query.status ?? '').trim()
    if (status === 'resolved') where.status = 'resolved'
    else if (status === 'open') where.status = 'open'
    else if (status === 'acknowledged') where.status = 'acknowledged'
    else if (status === 'all') {
      /* sem filtro */
    } else where.status = { [Op.in]: activeStatuses() } // padrão: pendentes

    const severity = String(query.severity ?? '').trim()
    if (['info', 'warning', 'critical'].includes(severity)) where.severity = severity

    const type = String(query.type ?? '').trim()
    if ((ALERT_CATALOG as any)[type]) where.type = type

    return where
  },

  async listForAgency(actor: AgencyActor, query: Record<string, unknown> = {}) {
    const rows = await JobAlert.findAll({
      where: { ...this.buildFilters(query), audience: { [Op.contains]: ['agency'] } },
      include: [
        {
          model: Job,
          as: 'alertJob',
          required: true,
          include: [
            {
              model: Supermarket,
              as: 'jobSupermarket',
              required: true,
              where: { agencyId: actor.agencyId },
              attributes: ['id', 'name', 'agencyId'],
            },
            { model: Branch, as: 'jobBranch', attributes: ['id', 'name'] },
          ],
        },
        { model: Freelancer, as: 'alertFreelancer', attributes: ['id', 'name', 'phone', 'profilePhotoUrl'] },
        { model: JobShift, as: 'alertShift', attributes: ['id', 'startTime', 'endTime', 'position'] },
      ],
      order: [
        ['status', 'ASC'],
        ['severity', 'DESC'],
        ['detectedAt', 'DESC'],
      ],
    })
    const scoped = actor.isOwner
      ? rows
      : rows.filter(
          (a: any) =>
            inBranchScope(actor, a.alertJob?.branchId) && inFreelancerScope(actor, a.freelancerId)
        )
    return scoped.map((a) => this.serialize(a))
  },

  async listForSupermarket(ctx: SupermarketContext, query: Record<string, unknown> = {}) {
    const jobWhere: any = { supermarketId: ctx.supermarketId }
    if (ctx.branchIds && ctx.branchIds.length) jobWhere.branchId = { [Op.in]: ctx.branchIds }
    const rows = await JobAlert.findAll({
      where: { ...this.buildFilters(query), audience: { [Op.contains]: ['supermarket'] } },
      include: [
        {
          model: Job,
          as: 'alertJob',
          required: true,
          where: jobWhere,
          include: [{ model: Branch, as: 'jobBranch', attributes: ['id', 'name'] }],
        },
        { model: Freelancer, as: 'alertFreelancer', attributes: ['id', 'name', 'phone', 'profilePhotoUrl'] },
        { model: JobShift, as: 'alertShift', attributes: ['id', 'startTime', 'endTime', 'position'] },
      ],
      order: [
        ['status', 'ASC'],
        ['severity', 'DESC'],
        ['detectedAt', 'DESC'],
      ],
    })
    return rows.map((a) => this.serialize(a))
  },

  summarize(list: { status: string; severity: string; type: string }[]) {
    const open = list.filter((a) => a.status !== 'resolved').length
    const critical = list.filter((a) => a.status !== 'resolved' && a.severity === 'critical').length
    const byType: Record<string, number> = {}
    for (const a of list) {
      if (a.status === 'resolved') continue
      byType[a.type] = (byType[a.type] ?? 0) + 1
    }
    return { open, critical, byType }
  },

  async summaryForAgency(actor: AgencyActor) {
    return this.summarize(await this.listForAgency(actor, {}))
  },

  async summaryForSupermarket(ctx: SupermarketContext) {
    return this.summarize(await this.listForSupermarket(ctx, {}))
  },

  /** Carrega a ocorrência garantindo que pertence à rede do ator (e ao escopo do líder). */
  async loadForActor(id: string, actor: AgencyActor) {
    const alert = await JobAlert.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'alertJob',
          include: [{ model: Supermarket, as: 'jobSupermarket', attributes: ['id', 'agencyId'] }],
        },
      ],
    })
    if (!alert) throw new Error('Ocorrência não encontrada.')
    const a = alert as any
    if (a.alertJob?.jobSupermarket?.agencyId !== actor.agencyId) {
      throw new Error('Esta ocorrência não pertence à sua agência.')
    }
    if (!actor.isOwner) {
      if (!inBranchScope(actor, a.alertJob?.branchId) || !inFreelancerScope(actor, a.freelancerId)) {
        throw new Error('Esta ocorrência está fora do seu grupo de trabalho.')
      }
    }
    return alert
  },

  async acknowledge(id: string, actor: AgencyActor, userId: string) {
    const alert = await this.loadForActor(id, actor)
    if (alert.status === 'open') {
      await alert.update({ status: 'acknowledged', acknowledgedAt: new Date(), acknowledgedByUserId: userId })
    }
    return this.reload(alert.id)
  },

  async resolveManually(
    id: string,
    actor: AgencyActor,
    userId: string,
    body: { code?: AlertResolutionCode; note?: string | null } = {}
  ) {
    const alert = await this.loadForActor(id, actor)
    if (alert.status !== 'resolved') {
      await alert.update({
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: actor.isOwner ? 'agency' : 'leader',
        resolvedByUserId: userId,
        resolutionCode: body.code === 'dismissed' ? 'dismissed' : 'acted',
        resolutionNote: body.note?.trim() || null,
      })
    }
    return this.reload(alert.id)
  },

  async reload(id: string) {
    const alert = await JobAlert.findByPk(id, {
      include: [
        {
          model: Job,
          as: 'alertJob',
          include: [{ model: Branch, as: 'jobBranch', attributes: ['id', 'name'] }],
        },
        { model: Freelancer, as: 'alertFreelancer', attributes: ['id', 'name', 'phone', 'profilePhotoUrl'] },
        { model: JobShift, as: 'alertShift', attributes: ['id', 'startTime', 'endTime', 'position'] },
      ],
    })
    return alert ? this.serialize(alert) : null
  },

  // ————————————————————————————————————————————————————————————————
  // Varredura periódica (ausência de evento)
  // ————————————————————————————————————————————————————————————————

  async sweep(now = new Date()) {
    const jobs = await Job.findAll({
      where: { status: { [Op.in]: ['pending', 'accepted', 'in_progress'] } },
      include: [
        { model: JobShift, as: 'shifts', include: [{ model: JobShiftBreak, as: 'breaks' }] },
        { model: Supermarket, as: 'jobSupermarket', attributes: ['id', 'agencyId'] },
        { model: Freelancer, as: 'assignedFreelancer', attributes: ['id', 'name'] },
        { model: Branch, as: 'jobBranch', attributes: ['id', 'name'] },
        { model: Category, as: 'jobCategory', attributes: ['id', 'name'] },
      ],
    })

    const agencyIds = [
      ...new Set(jobs.map((j: any) => j.jobSupermarket?.agencyId).filter(Boolean)),
    ] as string[]
    const agencies = await Agency.findAll({ where: { id: { [Op.in]: agencyIds } } })
    const agencyById = new Map(agencies.map((a) => [a.id, a]))

    for (const job of jobs as any[]) {
      const agency = agencyById.get(job.jobSupermarket?.agencyId)
      const settings = resolveAlertSettings(agency)
      if (!settings.alertsEnabled) continue
      try {
        await this.evaluateJob(job, agency, settings, now)
      } catch (err) {
        console.error(`⚠️ alert sweep job ${job.id}:`, err instanceof Error ? err.message : err)
      }
    }

    // Ocorrências da varredura penduradas em vagas que já foram concluídas/canceladas.
    const stale = await JobAlert.findAll({
      where: {
        status: { [Op.in]: activeStatuses() },
        type: { [Op.in]: [...SWEEPER_OWNED_TYPES] },
      },
      include: [
        {
          model: Job,
          as: 'alertJob',
          required: true,
          where: { status: { [Op.in]: ['completed', 'canceled'] } },
          attributes: ['id', 'status'],
        },
      ],
    })
    for (const a of stale) await this.resolveByKey(a.dedupeKey, { code: 'auto' })
  },

  async evaluateJob(job: any, agency: any, settings: AlertSettings, now: Date) {
    const base = {
      jobId: job.id,
      freelancerId: job.freelancerId ?? null,
      settings,
    }
    const label = `${job.title}${job.jobBranch?.name ? ` — ${job.jobBranch.name}` : ''}`
    const { firstStart, lastEnd, shifts } = shiftWindow(job)
    /** Tipos que deveriam estar abertos agora nesta vaga — o resto (dono da varredura) é auto-resolvido. */
    const shouldBeOpen = new Set<string>()

    // —— Vaga sem colaborador ——————————————————————————————————————
    if (job.status === 'pending' && !job.freelancerId) {
      const minsToStart = Math.round((firstStart.getTime() - now.getTime()) / 60000)
      if (now >= firstStart && now < lastEnd) {
        shouldBeOpen.add('shift_unfilled_started')
        await this.raise({
          ...base,
          type: 'shift_unfilled_started',
          title: `Vaga descoberta: ${label}`,
          message: `O turno começou às ${hm(firstStart)} (${dm(firstStart)}) e ninguém aceitou a vaga. Atribua um colaborador ou cancele o item do pedido.`,
          context: { expectedAt: firstStart.toISOString() },
        })
      } else if (minsToStart > 0 && minsToStart <= settings.unfilledAlertLeadMinutes) {
        shouldBeOpen.add('shift_unfilled_soon')
        await this.raise({
          ...base,
          type: 'shift_unfilled_soon',
          severity: minsToStart <= UNFILLED_URGENT_MINUTES ? 'critical' : 'warning',
          title: `Vaga ainda sem colaborador: ${label}`,
          message: `Faltam ${minLabel(minsToStart)} para o início (${hm(firstStart)}) e a vaga não foi aceita.`,
          context: { expectedAt: firstStart.toISOString(), minutesLate: -minsToStart },
        })
      }
    }

    // —— Colaborador aceitou mas não bateu ponto ————————————————————
    if (job.status === 'accepted' && job.freelancerId) {
      const anyCheckIn = shifts.some((s: any) => s.checkInAt)
      if (!anyCheckIn && now >= lastEnd) {
        shouldBeOpen.add('no_show')
        await this.raise({
          ...base,
          type: 'no_show',
          title: `Falta: ${label}`,
          message: `${job.assignedFreelancer?.name ?? 'O colaborador'} não bateu o check-in e a janela da vaga (até ${hm(lastEnd)}) terminou. Registre a falta ou troque o colaborador.`,
          context: { expectedAt: firstStart.toISOString() },
        })
      } else {
        const candidate = shifts.find(
          (s: any) => s.status === 'pending' && new Date(s.endTime).getTime() > now.getTime()
        )
        const anchor = candidate ?? (shifts.length ? shifts[0] : null)
        const startRef = anchor ? new Date(anchor.startTime) : firstStart
        const minsLate = Math.round((now.getTime() - startRef.getTime()) / 60000)
        if (minsLate > settings.lateCheckinToleranceMinutes && (!anchor || now < new Date(anchor.endTime))) {
          shouldBeOpen.add('late_checkin')
          await this.raise({
            ...base,
            jobShiftId: anchor?.id ?? null,
            type: 'late_checkin',
            severity: minsLate > settings.lateCheckinCriticalMinutes ? 'critical' : 'warning',
            title: `Atraso no check-in: ${label}`,
            message: `${job.assignedFreelancer?.name ?? 'O colaborador'} está com ${minLabel(minsLate)} de atraso — o turno começou às ${hm(startRef)} e o ponto ainda não foi registrado.`,
            context: { expectedAt: startRef.toISOString(), minutesLate: minsLate, shiftPosition: anchor?.position ?? null },
          })
        }
      }
    }

    // —— Vaga em andamento ————————————————————————————————————————
    if (job.status === 'in_progress') {
      const openShift = shifts.find((s: any) => s.status === 'in_progress')
      if (openShift) {
        const breaks: any[] = openShift.breaks ?? []
        const openBreak = breaks.find((b) => !b.endAt)
        const shiftEnd = new Date(openShift.endTime)
        if (openBreak) {
          const openFor = minutesBetween(openBreak.startAt, now)
          if (now > shiftEnd) {
            shouldBeOpen.add('break_not_resumed')
            await this.raise({
              ...base,
              jobShiftId: openShift.id,
              type: 'break_not_resumed',
              title: `Pausa não retomada: ${label}`,
              message: `A pausa começou às ${hm(openBreak.startAt)}, o turno já deveria ter terminado (${hm(shiftEnd)}) e o ponto segue pausado.`,
              context: { minutesOver: minutesBetween(shiftEnd, now), breakMinutes: openFor },
            })
          } else {
            const closedSum = await sumClosedBreakMinutes(openShift.id)
            const limit = resolveBreakLimitMinutes(job, agency)
            const overLimit = limit != null && closedSum + openFor >= limit
            if (openFor > BREAK_OPEN_ALERT_MINUTES || overLimit) {
              shouldBeOpen.add('break_overrun')
              await this.raise({
                ...base,
                jobShiftId: openShift.id,
                type: 'break_overrun',
                title: `Pausa longa: ${label}`,
                message: overLimit
                  ? `As pausas do turno somam ${minLabel(closedSum + openFor)}${limit != null ? ` (limite de ${minLabel(limit)})` : ''}.`
                  : `A pausa está aberta há ${minLabel(openFor)} (desde ${hm(openBreak.startAt)}).`,
                context: { breakMinutes: closedSum + openFor },
              })
            }
          }
        } else {
          const graceEnd = new Date(shiftEnd.getTime() + settings.missingCheckoutGraceMinutes * 60000)
          if (now > graceEnd) {
            const minsOver = minutesBetween(shiftEnd, now)
            shouldBeOpen.add('missing_checkout')
            await this.raise({
              ...base,
              jobShiftId: openShift.id,
              type: 'missing_checkout',
              severity: minsOver > MISSING_CHECKOUT_CRITICAL_MINUTES ? 'critical' : 'warning',
              title: `Turno sem check-out: ${label}`,
              message: `O turno terminou às ${hm(shiftEnd)} e ${job.assignedFreelancer?.name ?? 'o colaborador'} não bateu o check-out (${minLabel(minsOver)} em aberto). Force o checkout pela agência ou corrija o ponto.`,
              context: { expectedAt: shiftEnd.toISOString(), minutesOver: minsOver, shiftPosition: openShift.position },
            })
          }
        }
      }

      // Turno perdido no meio de uma vaga multi-turno.
      const missed = shifts.find(
        (s: any) =>
          s.status === 'missed' ||
          (s.status === 'pending' && new Date(s.endTime).getTime() < now.getTime())
      )
      if (missed) {
        shouldBeOpen.add('shift_missed')
        await this.raise({
          ...base,
          jobShiftId: missed.id,
          type: 'shift_missed',
          title: `Turno perdido: ${label}`,
          message: `O turno de ${hm(missed.startTime)} às ${hm(missed.endTime)} não foi cumprido. Decida entre aceitar a entrega parcial ou reabrir o restante.`,
          context: { shiftPosition: missed.position },
        })
      }
    }

    // —— Auto-resolução das ocorrências da varredura que não valem mais ——
    const openSweeperAlerts = await JobAlert.findAll({
      where: {
        jobId: job.id,
        status: { [Op.in]: activeStatuses() },
        type: { [Op.in]: [...SWEEPER_OWNED_TYPES] },
      },
    })
    for (const a of openSweeperAlerts) {
      if (!shouldBeOpen.has(a.type)) {
        await this.resolveByKey(a.dedupeKey, { code: 'auto' })
      }
    }
  },
}
