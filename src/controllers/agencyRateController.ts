import { Response } from 'express'
import { agencyRateService } from '../services/agencyRateService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

async function requireAgencyId(req: AuthRequest, res: Response) {
  const agencyId = await profileService.agencyIdForUser(req.user!)
  if (!agencyId) {
    res.status(400).json({ message: 'Cadastre a agência antes de definir valores.' })
    return null
  }
  return agencyId
}

export const agencyRateController = {
  // GET /agency/rates
  async index(req: AuthRequest, res: Response) {
    try {
      const agencyId = await requireAgencyId(req, res)
      if (!agencyId) return
      return res.json(await agencyRateService.listForAgency(agencyId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /agency/rates  { categoryId, hourlyRate, active? }
  async create(req: AuthRequest, res: Response) {
    try {
      const agencyId = await requireAgencyId(req, res)
      if (!agencyId) return
      return res.status(201).json(await agencyRateService.upsert(agencyId, req.body))
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /agency/rates/:id  { hourlyRate?, active? }
  async update(req: AuthRequest, res: Response) {
    try {
      const agencyId = await requireAgencyId(req, res)
      if (!agencyId) return
      return res.json(await agencyRateService.update(req.params.id, agencyId, req.body))
    } catch (error) {
      return fail(res, error)
    }
  },

  // DELETE /agency/rates/:id
  async remove(req: AuthRequest, res: Response) {
    try {
      const agencyId = await requireAgencyId(req, res)
      if (!agencyId) return
      return res.json(await agencyRateService.remove(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },
}
