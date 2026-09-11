import { Response } from 'express'
import { invoiceAdjustmentService } from '../services/invoiceAdjustmentService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

export const invoiceAdjustmentController = {
  // GET /invoices/:id/adjustments
  async list(req: AuthRequest, res: Response) {
    try {
      const role = req.user!.role
      const scope =
        role === 'supermarket'
          ? { supermarketId: (await profileService.supermarketIdForUser(req.user!)) ?? '—' }
          : role === 'agency' || role === 'partner'
          ? { agencyId: (await profileService.agencyIdForUser(req.user!)) ?? '—' }
          : undefined
      return res.json(await invoiceAdjustmentService.listForInvoice(req.params.id, scope))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /invoices/:id/adjustments (supermercado)
  async create(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      const adjustment = await invoiceAdjustmentService.createBySupermarket(
        req.params.id,
        supermarketId,
        req.user!.id,
        { description: req.body.description, amount: req.body.amount }
      )
      return res.status(201).json(adjustment)
    } catch (error) {
      return fail(res, error)
    }
  },

  // DELETE /invoices/:id/adjustments/:adjId (supermercado)
  async remove(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      return res.json(
        await invoiceAdjustmentService.removeBySupermarket(req.params.id, req.params.adjId, supermarketId)
      )
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /invoices/:id/adjustments/:adjId/approve (agência)
  async approve(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(
        await invoiceAdjustmentService.approve(req.params.id, req.params.adjId, agencyId, req.user!.id)
      )
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /invoices/:id/adjustments/:adjId/reject (agência)
  async reject(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(
        await invoiceAdjustmentService.reject(req.params.id, req.params.adjId, agencyId, req.user!.id, {
          note: req.body.note,
        })
      )
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /invoices/:id/adjustments/:adjId/revert (agência)
  async revert(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(
        await invoiceAdjustmentService.revert(req.params.id, req.params.adjId, agencyId)
      )
    } catch (error) {
      return fail(res, error)
    }
  },
}
