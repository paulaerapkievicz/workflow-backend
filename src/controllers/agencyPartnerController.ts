import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import { profileService } from '../services/profileService'
import { agencyPartnerService } from '../services/agencyPartnerService'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

/**
 * Só o dono da agência gerencia sócios (criar, editar permissões, desativar) — as rotas usam
 * authorize('agency'). Mesmo um sócio com a permissão 'equipe' não gerencia outros sócios,
 * só líderes — evita escalonamento de privilégio entre sócios.
 */
async function ownerAgencyId(req: AuthRequest, res: Response): Promise<string | null> {
  const agencyId = await profileService.agencyIdForUser(req.user!)
  if (!agencyId) {
    res.status(403).json({ message: 'Agência não encontrada.' })
    return null
  }
  return agencyId
}

export const agencyPartnerController = {
  // GET /agency/partners
  async index(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.json(await agencyPartnerService.list(agencyId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /agency/partners
  async create(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.status(201).json(await agencyPartnerService.createDirect(agencyId, req.body ?? {}))
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /agency/partners/:id
  async update(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.json(await agencyPartnerService.update(req.params.id, agencyId, req.body ?? {}))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /agency/partners/:id/reset-password
  async resetPassword(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.json(await agencyPartnerService.resetPassword(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // DELETE /agency/partners/:id — desativa (mantém histórico)
  async remove(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.json(await agencyPartnerService.deactivate(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },
}
