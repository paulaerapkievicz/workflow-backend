import { Response } from 'express'
import { withdrawalService } from '../services/withdrawalService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

export const withdrawalController = {
  // POST /withdrawals (freelancer | agency)
  async create(req: AuthRequest, res: Response) {
    try {
      const withdrawal = await withdrawalService.request(req.user!, Number(req.body.amount))
      return res.status(201).json(withdrawal)
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /withdrawals/mine
  async mine(req: AuthRequest, res: Response) {
    try {
      return res.json(await withdrawalService.listForUser(req.user!))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /withdrawals/:id/process (admin)
  async process(req: AuthRequest, res: Response) {
    try {
      return res.json(await withdrawalService.process(req.params.id, req.body.status))
    } catch (error) {
      return fail(res, error)
    }
  },
}
