// src/controllers/jobLogsController.ts

import { Response } from 'express'
import { jobLogService } from '../services/jobLogService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

async function requireFreelancerId(req: AuthRequest, res: Response) {
  const freelancer = await profileService.freelancerForUser(req.user!)
  if (!freelancer) {
    res.status(400).json({ message: 'Perfil de freelancer não encontrado.' })
    return null
  }
  return freelancer.id
}

export const jobLogsController = {
  async findAll(_req: AuthRequest, res: Response) {
    try {
      return res.json(await jobLogService.findAll())
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  async index(req: AuthRequest, res: Response) {
    try {
      return res.json(await jobLogService.findByJob(req.params.id))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  async findByFreelancer(req: AuthRequest, res: Response) {
    try {
      return res.json(await jobLogService.findByFreelancer(req.params.id))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  async findByStatus(req: AuthRequest, res: Response) {
    try {
      return res.json(await jobLogService.findByStatus(String(req.query.status)))
    } catch (error) {
      return fail(res, error)
    }
  },

  async checkIn(req: AuthRequest, res: Response) {
    try {
      const freelancerId = await requireFreelancerId(req, res)
      if (!freelancerId) return
      return res.status(201).json(await jobLogService.checkIn(req.params.id, freelancerId, req.body ?? {}))
    } catch (error) {
      return fail(res, error)
    }
  },

  async registerInterval(req: AuthRequest, res: Response) {
    try {
      const freelancerId = await requireFreelancerId(req, res)
      if (!freelancerId) return
      return res.status(201).json(await jobLogService.registerInterval(req.params.id, freelancerId, req.body.eventType))
    } catch (error) {
      return fail(res, error)
    }
  },

  async checkOut(req: AuthRequest, res: Response) {
    try {
      const freelancerId = await requireFreelancerId(req, res)
      if (!freelancerId) return
      return res.status(201).json(await jobLogService.checkOut(req.params.id, freelancerId, req.body ?? {}))
    } catch (error) {
      return fail(res, error)
    }
  },
}
