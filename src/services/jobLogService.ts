// src/services/jobLogService.ts

import { Op } from 'sequelize'
import { JobLog } from '../models/JobLog'
import { Job } from '../models/Job'
import { JobShift } from '../models/JobShift'
import { JobPhoto } from '../models/JobPhoto'
import { Branch } from '../models/Branch'
import { Freelancer, FreelancerInstance } from '../models/Freelancer'
import { Agency } from '../models/Agency'
import { FreelancerLocation } from '../models/FreelancerLocation'
import { paymentService } from './paymentService'
import { orderService } from './orderService'
import { distanceInMeters } from '../helpers/geo'
import { minutesBetween } from '../helpers/time'

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

    if (job.requireCheckoutPhoto ?? agency?.requireCheckoutPhoto) {
      const photos = await JobPhoto.count({ where: { jobId } })
      if (photos === 0) throw new Error('Anexe ao menos uma foto de comprovação antes do check-out.')
    }

    const now = new Date()
    const workedMinutes = shift.checkInAt ? minutesBetween(shift.checkInAt, now) : 0

    const log = await JobLog.create({
      jobId, freelancerId: freelancer.id, jobShiftId: shift.id,
      eventType: 'check-out', timestamp: now, latitude, longitude, accuracy,
    })
    await shift.update({ status: 'done', checkOutAt: now, workedMinutes })
    await FreelancerLocation.create({ freelancerId: freelancer.id, jobId, latitude, longitude, timestamp: now })

    const shifts = await JobShift.findAll({ where: { jobId } })
    let completed = false
    if (shifts.every((s) => ['done', 'missed'].includes(s.status))) {
      const totalWorked = shifts.reduce((acc, s) => acc + (s.workedMinutes ?? 0), 0)
      await job.update({ status: 'completed', workedMinutes: totalWorked, completedAt: now })
      await paymentService.settleForJob(await job.reload())
      await orderService.syncStatus(job.orderId)
      completed = true
      // check-out encerra o rastreamento em tempo real (a vaga sai do "ao vivo").
    }
    return { log, shift: await shift.reload(), jobCompleted: completed }
  },
}
