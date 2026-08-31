// src/services/jobLogService.ts

import { Op } from 'sequelize'
import { JobLog } from '../models/JobLog'
import { Job } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { JobPhoto } from '../models/JobPhoto'
import { Branch } from '../models/Branch'
import { FreelancerLocation } from '../models/FreelancerLocation'
import { paymentService } from './paymentService'
import { orderService } from './orderService'
import { distanceInMeters } from '../helpers/geo'
import { minutesBetween } from '../helpers/time'

type IntervalEvent = 'break-start' | 'break-end'

export interface GeoInput {
  latitude?: number | string | null
  longitude?: number | string | null
  accuracy?: number | string | null
}

async function loadOwnedJob(jobId: string, freelancerId: string) {
  const job = await Job.findByPk(jobId)
  if (!job) throw new Error('Vaga não encontrada.')
  if (job.freelancerId !== freelancerId) throw new Error('Esta vaga não está atribuída a você.')
  return job
}

function parseGeo(geo: GeoInput) {
  const lat = geo?.latitude != null ? Number(geo.latitude) : NaN
  const lng = geo?.longitude != null ? Number(geo.longitude) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Localização obrigatória: ative o GPS e permita o acesso à sua posição.')
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Coordenadas inválidas.')
  }
  const accuracy = geo?.accuracy != null && Number.isFinite(Number(geo.accuracy)) ? Number(geo.accuracy) : null
  return { latitude: lat, longitude: lng, accuracy }
}

/** Valida se o freelancer está dentro do raio da filial (quando a filial tem coordenadas). */
async function assertWithinGeofence(job: Job, lat: number, lng: number) {
  const branch = await Branch.findByPk(job.branchId)
  if (!branch || branch.latitude == null || branch.longitude == null) return
  const dist = distanceInMeters(Number(branch.latitude), Number(branch.longitude), lat, lng)
  const radius = branch.geofenceRadius ?? 300
  if (dist > radius) {
    throw new Error(
      `Você está a ${Math.round(dist)}m da filial (limite de ${radius}m). Aproxime-se do local do serviço para registrar o ponto.`
    )
  }
}

/** Minutos de intervalo já fechados de um turno (pares início/fim). */
async function breakMinutesForShift(jobId: string, jobShiftId: string) {
  const logs = await JobLog.findAll({
    where: { jobId, jobShiftId, eventType: { [Op.in]: ['break-start', 'break-end'] } },
    order: [['timestamp', 'ASC']],
  })
  let total = 0
  let openStart: Date | null = null
  for (const log of logs) {
    if (log.eventType === 'break-start') openStart = log.timestamp
    else if (log.eventType === 'break-end' && openStart) {
      total += minutesBetween(openStart, log.timestamp)
      openStart = null
    }
  }
  return total
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
    const valid = ['check-in', 'check-out', 'break-start', 'break-end']
    if (!valid.includes(status)) throw new Error('Tipo de evento inválido.')
    return JobLog.findAll({ where: { eventType: status } })
  },

  async checkIn(jobId: string, freelancerId: string, geo: GeoInput) {
    const job = await loadOwnedJob(jobId, freelancerId)
    if (!['accepted', 'in_progress'].includes(job.status)) {
      throw new Error('O check-in só pode ser feito em uma vaga aceita ou em andamento.')
    }
    const { latitude, longitude, accuracy } = parseGeo(geo)
    await assertWithinGeofence(job, latitude, longitude)

    const openShift = await JobShift.findOne({ where: { jobId, status: 'in_progress' } })
    if (openShift) throw new Error('Faça o check-out do turno atual antes de iniciar o próximo.')

    const shift = await JobShift.findOne({
      where: { jobId, status: 'pending' },
      order: [['position', 'ASC']],
    })
    if (!shift) throw new Error('Todos os turnos desta vaga já foram registrados.')

    const now = new Date()
    const log = await JobLog.create({
      jobId,
      freelancerId,
      jobShiftId: shift.id,
      eventType: 'check-in',
      timestamp: now,
      latitude,
      longitude,
      accuracy,
    })
    await shift.update({ status: 'in_progress', checkInAt: now })
    await FreelancerLocation.create({ freelancerId, jobId, latitude, longitude, timestamp: now })

    if (job.status === 'accepted') {
      await job.update({ status: 'in_progress' })
      await orderService.syncStatus(job.orderId)
    }
    return { log, shift: await shift.reload() }
  },

  async checkOut(jobId: string, freelancerId: string, geo: GeoInput) {
    const job = await loadOwnedJob(jobId, freelancerId)
    if (job.status !== 'in_progress') {
      throw new Error('O check-out só pode ser feito em uma vaga em andamento.')
    }
    const { latitude, longitude, accuracy } = parseGeo(geo)
    await assertWithinGeofence(job, latitude, longitude)

    const shift = await JobShift.findOne({ where: { jobId, status: 'in_progress' } })
    if (!shift) throw new Error('Nenhum turno em andamento. Faça o check-in primeiro.')

    if (job.photosRequired) {
      const photos = await JobPhoto.count({ where: { jobId } })
      if (photos === 0) {
        throw new Error('Anexe ao menos uma foto de comprovação antes do check-out.')
      }
    }

    const now = new Date()
    const breaks = await breakMinutesForShift(jobId, shift.id)
    const grossMinutes = shift.checkInAt ? minutesBetween(shift.checkInAt, now) : 0
    const workedMinutes = Math.max(0, grossMinutes - breaks)

    const log = await JobLog.create({
      jobId,
      freelancerId,
      jobShiftId: shift.id,
      eventType: 'check-out',
      timestamp: now,
      latitude,
      longitude,
      accuracy,
    })
    await shift.update({ status: 'done', checkOutAt: now, workedMinutes })
    await FreelancerLocation.create({ freelancerId, jobId, latitude, longitude, timestamp: now })

    const shifts = await JobShift.findAll({ where: { jobId } })
    const allDone = shifts.every((s) => s.status === 'done')
    let completed = false
    if (allDone) {
      const totalWorked = shifts.reduce((acc, s) => acc + (s.workedMinutes ?? 0), 0)
      await job.update({ status: 'completed', workedMinutes: totalWorked, completedAt: now })
      await paymentService.settleForJob(await job.reload())
      await orderService.syncStatus(job.orderId)
      completed = true
    }
    return { log, shift: await shift.reload(), jobCompleted: completed }
  },

  async registerInterval(jobId: string, freelancerId: string, eventType: IntervalEvent) {
    if (!['break-start', 'break-end'].includes(eventType)) {
      throw new Error('Tipo de intervalo inválido.')
    }
    const job = await loadOwnedJob(jobId, freelancerId)
    if (job.status !== 'in_progress') {
      throw new Error('Intervalos só podem ser registrados durante a jornada.')
    }
    const shift = await JobShift.findOne({ where: { jobId, status: 'in_progress' } })
    if (!shift) throw new Error('Nenhum turno em andamento.')

    const last = await JobLog.findOne({
      where: { jobId, jobShiftId: shift.id, eventType: { [Op.in]: ['break-start', 'break-end'] } },
      order: [['timestamp', 'DESC']],
    })
    if (eventType === 'break-start' && last?.eventType === 'break-start') {
      throw new Error('Já existe um intervalo em aberto.')
    }
    if (eventType === 'break-end' && last?.eventType !== 'break-start') {
      throw new Error('Não há intervalo em aberto para encerrar.')
    }

    return JobLog.create({ jobId, freelancerId, jobShiftId: shift.id, eventType, timestamp: new Date() })
  },
}
