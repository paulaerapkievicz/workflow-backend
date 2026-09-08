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

  async getByFreelancerId(req: AuthRequest, res: Response) {
    try {
      return res.json(await reviewService.getByFreelancerId(req.params.id))
    } catch (error) {
      return fail(res, error)
    }
  },

  async getByJob(req: AuthRequest, res: Response) {
    try {
      return res.json(await reviewService.getByJob(req.params.id))
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /freelancers/:id/reputation — nota média + horas trabalhadas + convocações concluídas.
  async reputation(req: AuthRequest, res: Response) {
    try {
      return res.json(await reviewService.reputationForFreelancer(req.params.id))
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
