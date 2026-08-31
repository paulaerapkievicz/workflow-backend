import { Response } from 'express'
import { billingService } from '../services/billingService'
import { reportService } from '../services/reportService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

export const billingController = {
  // GET /billing/summary (supermarket) — faturamento: histórico por mês/função
  async summary(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      return res.json(await billingService.summaryForSupermarket(supermarketId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /reports/freelancer (freelancer) — trabalhos concluídos e valores
  async freelancerReport(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(403).json({ message: 'Perfil de freelancer não encontrado.' })
      return res.json(await reportService.freelancerReport(freelancer.id))
    } catch (error) {
      return fail(res, error, 500)
    }
  },
}
