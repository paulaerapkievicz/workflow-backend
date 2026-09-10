import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import { profileService } from '../services/profileService'
import { jobAlertService } from '../services/jobAlertService'

function fail(res: Response, err: unknown, code = 500) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

/** Resolve o público do usuário logado para as rotas de ocorrências. */
async function resolveActor(req: AuthRequest) {
  if (req.user!.role === 'supermarket') {
    const ctx = await profileService.supermarketContextForUser(req.user!)
    return ctx ? ({ kind: 'supermarket' as const, ctx }) : null
  }
  const actor = await profileService.agencyContextForUser(req.user!)
  return actor ? ({ kind: 'agency' as const, actor }) : null
}

export const alertController = {
  // GET /alerts
  async list(req: AuthRequest, res: Response) {
    try {
      const who = await resolveActor(req)
      if (!who) return res.status(403).json({ message: 'Perfil não encontrado.' })
      const data =
        who.kind === 'supermarket'
          ? await jobAlertService.listForSupermarket(who.ctx, req.query as Record<string, unknown>)
          : await jobAlertService.listForAgency(who.actor, req.query as Record<string, unknown>)
      return res.json(data)
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /alerts/summary
  async summary(req: AuthRequest, res: Response) {
    try {
      const who = await resolveActor(req)
      if (!who) return res.status(403).json({ message: 'Perfil não encontrado.' })
      const data =
        who.kind === 'supermarket'
          ? await jobAlertService.summaryForSupermarket(who.ctx)
          : await jobAlertService.summaryForAgency(who.actor)
      return res.json(data)
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /alerts/:id/acknowledge
  async acknowledge(req: AuthRequest, res: Response) {
    try {
      const actor = await profileService.agencyContextForUser(req.user!)
      if (!actor) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await jobAlertService.acknowledge(req.params.id, actor, req.user!.id))
    } catch (error) {
      return fail(res, error, 400)
    }
  },

  // POST /alerts/:id/resolve
  async resolve(req: AuthRequest, res: Response) {
    try {
      const actor = await profileService.agencyContextForUser(req.user!)
      if (!actor) return res.status(403).json({ message: 'Agência não encontrada.' })
      const resolved = await jobAlertService.resolveManually(req.params.id, actor, req.user!.id, {
        code: req.body?.code,
        note: req.body?.note,
      })
      return res.json(resolved)
    } catch (error) {
      return fail(res, error, 400)
    }
  },

  // POST /internal/alerts/sweep — disparo manual/externo da varredura
  async sweep(_req: AuthRequest, res: Response) {
    try {
      await jobAlertService.sweep()
      return res.json({ ok: true })
    } catch (error) {
      return fail(res, error)
    }
  },
}
