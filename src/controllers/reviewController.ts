import { Response } from 'express'
import { reviewService } from '../services/reviewService'
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
      const review = await reviewService.getByJob(req.params.id)
      return res.json(review)
    } catch (error) {
      return fail(res, error)
    }
  },
}
