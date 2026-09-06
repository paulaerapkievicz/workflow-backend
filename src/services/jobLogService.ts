// src/services/jobLogService.ts

import { Op } from 'sequelize'
import { JobLog } from '../models/JobLog'
import { Job } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { JobShiftBreak } from '../models/JobShiftBreak'
import { JobPhoto } from '../models/JobPhoto'
import { Branch } from '../models/Branch'
import { Freelancer, FreelancerInstance } from '../models/Freelancer'
import { Agency } from '../models/Agency'
import { FreelancerLocation } from '../models/FreelancerLocation'
import { paymentService } from './paymentService'
import { orderService } from './orderService'
import { distanceInMeters } from '../helpers/geo'
import {
  minutesBetween,
  CHECKOUT_OVERTIME_TOLERANCE_MINUTES,
  CHECKIN_EARLY_TOLERANCE_MINUTES,
} from '../helpers/time'

/** Pausa/intervalo no ponto está habilitado para esta vaga? (override da vaga → padrão da agência) */
export function resolveBreaksEnabled(job: { breaksEnabled?: boolean | null }, agency: any): boolean {
  return job.breaksEnabled ?? agency?.breaksEnabled ?? false
}

/** Soma dos minutos das pausas já fechadas de um turno. */
export async function sumClosedBreakMinutes(jobShiftId: string): Promise<number> {
  const breaks = await JobShiftBreak.findAll({ where: { jobShiftId, endAt: { [Op.ne]: null } } })
  return breaks.reduce((acc, b) => acc + minutesBetween(b.startAt, b.endAt as Date), 0)
}

const BR_TZ = 'America/Sao_Paulo'
const hhmmBR = (d: Date | string) =>
  new Date(d).toLocaleTimeString('pt-BR', { timeZone: BR_TZ, hour: '2-digit', minute: '2-digit' })

export interface GeoInput {
  latitude?: number | string | null
  longitude?: number | string | null
  accuracy?: number | string | null
}

async function loadContext(jobId: string, freelancer: FreelancerInstance) {
  const job = await Job.findByPk(jobId)
  if (!job) throw new Error('Vaga não encontrada.')
  if (job.freelancerId !== freelancer.id) throw new Error('Esta vaga não está atribuída a você.')
  const agency = freelancer.agencyId ? await Agency.findByPk(freelancer.agencyId) : null
  return { job, agency }
}

function parseGeo(geo: GeoInput) {
  const lat = geo?.latitude != null ? Number(geo.latitude) : NaN
  const lng = geo?.longitude != null ? Number(geo.longitude) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Localização obrigatória: ative o GPS e permita o acesso à sua posição.')
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('Coordenadas inválidas.')
  const accuracy = geo?.accuracy != null && Number.isFinite(Number(geo.accuracy)) ? Number(geo.accuracy) : null
  return { latitude: lat, longitude: lng, accuracy }
}

/** Valida se o freelancer está dentro do raio (definido pela agência) do endereço da filial. */
async function assertWithinGeofence(job: Job, agency: any, lat: number, lng: number) {
  const branch = await Branch.findByPk(job.branchId)
  if (!branch || branch.latitude == null || branch.longitude == null) return // sem coordenadas => não bloqueia
  const dist = distanceInMeters(Number(branch.latitude), Number(branch.longitude), lat, lng)
  const radius = job.checkinRadius ?? agency?.checkinRadius ?? 300
  if (dist > radius) {
    throw new Error(
      `Você está a ${Math.round(dist)}m do local (limite de ${radius}m). Aproxime-se do endereço do serviço para registrar o ponto.`
    )
  }
}

export const jobLogService = {
  async findAll() {
    return JobLog.findAll({ order: [['timestamp', 'DESC']] })
  },
  async findByJob(jobId: string) {
    return JobLog.findAll({ where: { jobId }, order: [['timestamp', 'ASC']] })
  },
  async findByFreelancer(freelancerId: string) {
    return JobLog.findAll({ where: { freelancerId }, order: [['timestamp', 'DESC']] })
  },
  async findByStatus(status: string) {
    const valid = ['check-in', 'check-out', 'no-show', 'withdrawn']
    if (!valid.includes(status)) throw new Error('Tipo de evento inválido.')
    return JobLog.findAll({ where: { eventType: status } })
  },

  async checkIn(jobId: string, freelancer: FreelancerInstance, geo: GeoInput) {
    const { job, agency } = await loadContext(jobId, freelancer)
    if (!['accepted', 'in_progress'].includes(job.status)) {
      throw new Error('O check-in só pode ser feito em uma vaga aceita ou em andamento.')
    }
    const { latitude, longitude, accuracy } = parseGeo(geo)
    await assertWithinGeofence(job, agency, latitude, longitude)

    const openShift = await JobShift.findOne({ where: { jobId, status: 'in_progress' } })
    if (openShift) throw new Error('Faça o check-out do turno atual antes de iniciar o próximo.')

    // Não pode iniciar um turno se já houver outro trabalho em andamento (check-in aberto em outra vaga).
    const openElsewhere = await JobShift.findOne({
      where: { status: 'in_progress', jobId: { [Op.ne]: jobId } },
      include: [{ model: Job, as: 'shiftJob', required: true, where: { freelancerId: freelancer.id } }],
    })
    if (openElsewhere) {
      throw new Error('Você tem um turno em andamento em outra vaga. Faça o check-out antes de iniciar este.')
    }

    const now = new Date()
    // Turnos cujo horário já terminou ficam bloqueados — só se trabalha do horário atual em diante.
    await JobShift.update(
      { status: 'missed' },
      { where: { jobId, status: 'pending', endTime: { [Op.lte]: now } } }
    )
    const shift = await JobShift.findOne({
      where: { jobId, status: 'pending', endTime: { [Op.gt]: now } },
      order: [['position', 'ASC']],
    })
    if (!shift) throw new Error('Todos os turnos desta vaga já passaram.')

    // O check-in não pode ser feito muito antes do horário do turno — só atraso é tolerado.
    const earliestCheckIn = new Date(
      new Date(shift.startTime).getTime() - CHECKIN_EARLY_TOLERANCE_MINUTES * 60000
    )
    if (now < earliestCheckIn) {
      throw new Error(
        `Ainda não é hora do check-in. O turno começa às ${hhmmBR(shift.startTime)} — ` +
          `a entrada pode ser registrada a partir de ${CHECKIN_EARLY_TOLERANCE_MINUTES} min antes.`
      )
    }

    const log = await JobLog.create({
      jobId, freelancerId: freelancer.id, jobShiftId: shift.id,
      eventType: 'check-in', timestamp: now, latitude, longitude, accuracy,
    })
    await shift.update({ status: 'in_progress', checkInAt: now })
    await FreelancerLocation.create({ freelancerId: freelancer.id, jobId, latitude, longitude, timestamp: now })

    if (job.status === 'accepted') {
      await job.update({ status: 'in_progress' })
      await orderService.syncStatus(job.orderId)
    }
    return { log, shift: await shift.reload() }
  },

  async checkOut(jobId: string, freelancer: FreelancerInstance, geo: GeoInput) {
    const { job, agency } = await loadContext(jobId, freelancer)
    if (job.status !== 'in_progress') {
      throw new Error('O check-out só pode ser feito em uma vaga em andamento.')
    }
    const { latitude, longitude, accuracy } = parseGeo(geo)
    await assertWithinGeofence(job, agency, latitude, longitude)

    const shift = await JobShift.findOne({ where: { jobId, status: 'in_progress' } })
    if (!shift) throw new Error('Nenhum turno em andamento. Faça o check-in primeiro.')

    const openBreak = await JobShiftBreak.findOne({ where: { jobShiftId: shift.id, endAt: null } })
    if (openBreak) throw new Error('Retome o ponto (fim da pausa) antes de finalizar o turno.')

    if (job.requireCheckoutPhoto ?? agency?.requireCheckoutPhoto) {
      const photos = await JobPhoto.count({ where: { jobId } })
      if (photos === 0) throw new Error('Anexe ao menos uma foto de comprovação antes do check-out.')
    }

    const now = new Date()
    const breakMinutes = await sumClosedBreakMinutes(shift.id)
    const workedMinutes = shift.checkInAt
      ? Math.max(0, minutesBetween(shift.checkInAt, now) - breakMinutes)
      : 0

    const log = await JobLog.create({
      jobId, freelancerId: freelancer.id, jobShiftId: shift.id,
      eventType: 'check-out', timestamp: now, latitude, longitude, accuracy,
    })
    await shift.update({ status: 'done', checkOutAt: now, workedMinutes })
    await FreelancerLocation.create({ freelancerId: freelancer.id, jobId, latitude, longitude, timestamp: now })

    const shifts = await JobShift.findAll({ where: { jobId } })
    let completed = false
    let settlementHeld = false
    if (shifts.every((s) => ['done', 'missed'].includes(s.status))) {
      const totalWorked = shifts.reduce((acc, s) => acc + (s.workedMinutes ?? 0), 0)
      // Passou da tolerância sobre o turno contratado -> pagamento retido até a agência liberar.
      const contracted = job.contractedMinutes ?? 0
      settlementHeld = contracted > 0 && totalWorked > contracted + CHECKOUT_OVERTIME_TOLERANCE_MINUTES
      await job.update({
        status: 'completed',
        workedMinutes: totalWorked,
        completedAt: now,
        settlementHold: settlementHeld,
      })
      if (!settlementHeld) {
        await paymentService.settleForJob(await job.reload())
      }
      await orderService.syncStatus(job.orderId)
      completed = true
      // check-out encerra o rastreamento em tempo real (a vaga sai do "ao vivo").
    }
    return { log, shift: await shift.reload(), jobCompleted: completed, settlementHeld }
  },

  /**
   * Abre uma pausa/intervalo no turno em andamento. `startedBy` = 'freelancer' (o próprio)
   * ou 'agency' (registrando no lugar dele). A vaga precisa ter o recurso de pausa habilitado.
   */
  async openBreak(
    jobId: string,
    freelancer: FreelancerInstance,
    startedBy: 'freelancer' | 'agency',
    geo?: GeoInput
  ) {
    const job = await Job.findByPk(jobId)
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.freelancerId !== freelancer.id) throw new Error('Esta vaga não está atribuída a este colaborador.')
    const agency = freelancer.agencyId ? await Agency.findByPk(freelancer.agencyId) : null
    if (!resolveBreaksEnabled(job, agency)) {
      throw new Error('A pausa/intervalo no ponto não está habilitada para esta vaga.')
    }
    if (job.status !== 'in_progress') throw new Error('Só é possível pausar o ponto durante um turno em andamento.')

    const shift = await JobShift.findOne({ where: { jobId, status: 'in_progress' } })
    if (!shift) throw new Error('Nenhum turno em andamento para pausar.')
    const already = await JobShiftBreak.findOne({ where: { jobShiftId: shift.id, endAt: null } })
    if (already) throw new Error('Já existe uma pausa aberta neste turno.')

    const now = new Date()
    const g = geo && geo.latitude != null && geo.longitude != null ? parseGeo(geo) : null
    const brk = await JobShiftBreak.create({
      jobShiftId: shift.id,
      jobId,
      freelancerId: freelancer.id,
      startAt: now,
      startedBy,
    })
    await JobLog.create({
      jobId,
      freelancerId: freelancer.id,
      jobShiftId: shift.id,
      eventType: 'break-start',
      timestamp: now,
      reason: startedBy === 'agency' ? 'Pausa registrada pela agência.' : null,
      latitude: g?.latitude ?? null,
      longitude: g?.longitude ?? null,
      accuracy: g?.accuracy ?? null,
    })
    return { break: brk, shift: await shift.reload() }
  },

  /** Fecha a pausa aberta do turno em andamento (retomar o ponto). */
  async closeBreak(
    jobId: string,
    freelancer: FreelancerInstance,
    startedBy: 'freelancer' | 'agency',
    geo?: GeoInput
  ) {
    const job = await Job.findByPk(jobId)
    if (!job) throw new Error('Vaga não encontrada.')
    if (job.freelancerId !== freelancer.id) throw new Error('Esta vaga não está atribuída a este colaborador.')

    const shift = await JobShift.findOne({ where: { jobId, status: 'in_progress' } })
    if (!shift) throw new Error('Nenhum turno em andamento.')
    const brk = await JobShiftBreak.findOne({ where: { jobShiftId: shift.id, endAt: null } })
    if (!brk) throw new Error('Não há pausa aberta para retomar.')

    const now = new Date()
    const g = geo && geo.latitude != null && geo.longitude != null ? parseGeo(geo) : null
    await brk.update({ endAt: now })
    await JobLog.create({
      jobId,
      freelancerId: freelancer.id,
      jobShiftId: shift.id,
      eventType: 'break-end',
      timestamp: now,
      reason: startedBy === 'agency' ? 'Pausa encerrada pela agência.' : null,
      latitude: g?.latitude ?? null,
      longitude: g?.longitude ?? null,
      accuracy: g?.accuracy ?? null,
    })
    return { break: await brk.reload(), shift: await shift.reload() }
  },
}
