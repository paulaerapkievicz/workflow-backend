import { Response } from 'express'
import { paymentService } from '../services/paymentService'
import { closingService } from '../services/closingService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'
import { PaymentInstance } from '../models/Payment'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

export const paymentController = {
  // GET /payments — todos (admin)
  async index(_req: AuthRequest, res: Response) {
    try {
      return res.json(await paymentService.findAll())
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /payments/mine — escopado + carteira opaca por papel
  async mine(req: AuthRequest, res: Response) {
    try {
      const user = req.user!
      let payments: PaymentInstance[] = []

      if (user.role === 'freelancer') {
        const f = await profileService.freelancerForUser(user)
        payments = f ? await paymentService.listForFreelancer(f.id) : []
      } else if (user.role === 'agency') {
        const agencyId = await profileService.agencyIdForUser(user)
        payments = agencyId ? await paymentService.listForAgency(agencyId) : []
      } else if (user.role === 'supermarket') {
        const supermarketId = await profileService.supermarketIdForUser(user)
        payments = supermarketId ? await paymentService.listForSupermarket(supermarketId) : []
      } else {
        payments = await paymentService.findAll()
      }

      return res.json(payments.map((p) => paymentService.serializeForRole(p, user.role)))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  async show(req: AuthRequest, res: Response) {
    try {
      const payment = await paymentService.findById(req.params.id)
      if (!payment) return res.status(404).json({ message: 'Pagamento não encontrado.' })
      return res.json(paymentService.serializeForRole(payment, req.user!.role))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /invoices/mine (supermarket)
  async myInvoices(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      return res.json(supermarketId ? await closingService.listForSupermarket(supermarketId) : [])
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /invoices/:id/pay (supermarket)
  async invoicePay(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      return res.json(await paymentService.invoicePay(req.params.id, supermarketId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /payments/:id/cancel (admin)
  async cancel(req: AuthRequest, res: Response) {
    try {
      return res.json(await paymentService.cancel(req.params.id))
    } catch (error) {
      return fail(res, error)
    }
  },
}
