import { Response } from 'express'
import { reviewService } from '../services/reviewService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 500) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

export const reviewController = {
  async getAll(_req: AuthRequest, res: Response) {
    try {
      return res.json(await reviewService.getAll())
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /freelancers/:id/reviews (agency/leader/admin) — todas as avaliações do colaborador.
  async getByFreelancerId(req: AuthRequest, res: Response) {
    try {
      return res.json(await reviewService.getByFreelancerId(req.params.id))
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /jobs/:id/review — avaliações da vaga, filtradas por papel de quem consulta.
  async getByJob(req: AuthRequest, res: Response) {
    try {
      const supermarketId =
        req.user!.role === 'supermarket' ? await profileService.supermarketIdForUser(req.user!) : null
      return res.json(await reviewService.getByJob(req.params.id, { role: req.user!.role, supermarketId }))
    } catch (error) {
      return fail(res, error, 400)
    }
  },

  // GET /agency/reviews (agency/leader) — todas as avaliações da rede (filtros ?freelancerId= / ?jobId=).
  async agencyReviews(req: AuthRequest, res: Response) {
    try {
      const actor = await profileService.agencyContextForUser(req.user!)
      if (!actor) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(
        await reviewService.listForAgency(actor.agencyId, {
          freelancerId: (req.query.freelancerId as string) || null,
          jobId: (req.query.jobId as string) || null,
          scopeFreelancerIds: actor.scopeFreelancerIds,
        })
      )
    } catch (error) {
      return fail(res, error, 400)
    }
  },

  // GET /freelancers/:id/reputation — nota média + horas trabalhadas + convocações concluídas.
  // A lista de avaliações individuais só vai para a agência/líder/admin.
  async reputation(req: AuthRequest, res: Response) {
    try {
      const includeReviews = ['agency', 'leader', 'admin'].includes(req.user!.role)
      return res.json(await reviewService.reputationForFreelancer(req.params.id, { includeReviews }))
    } catch (error) {
      return fail(res, error, 400)
    }
  },

  // POST /jobs/:id/review-by-supermarket — o supermercado avalia o colaborador da vaga.
  async createBySupermarket(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      const review = await reviewService.createSupermarketReview(req.params.id, supermarketId, {
        rating: Number(req.body.rating),
        comment: req.body.comment,
      })
      return res.status(201).json(review)
    } catch (error) {
      return fail(res, error, 400)
    }
  },
}
