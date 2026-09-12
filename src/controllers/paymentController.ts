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
      } else if (user.role === 'agency' || user.role === 'partner') {
        const agencyId = await profileService.agencyIdForUser(user)
        payments = agencyId ? await paymentService.listForAgency(agencyId) : []
      } else if (user.role === 'supermarket') {
        const supermarketId = await profileService.supermarketIdForUser(user)
        payments = supermarketId ? await paymentService.listForSupermarket(supermarketId) : []
      } else if (user.role === 'admin') {
        payments = await paymentService.findAll()
      } else {
        // Líder e demais papéis não têm acesso financeiro (nem à carteira de ninguém).
        return res.status(403).json({ message: 'Você não tem acesso financeiro.' })
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
      const user = req.user!
      const p = payment as any
      // Pagamento de outra agência/rede/pessoa não existe pra quem pergunta.
      if (user.role === 'freelancer') {
        const f = await profileService.freelancerForUser(user)
        if (!f || f.id !== payment.freelancerId) {
          return res.status(404).json({ message: 'Pagamento não encontrado.' })
        }
      } else if (user.role === 'agency' || user.role === 'partner') {
        const agencyId = await profileService.agencyIdForUser(user)
        if (!agencyId || p.paymentFreelancer?.agencyId !== agencyId) {
          return res.status(404).json({ message: 'Pagamento não encontrado.' })
        }
      } else if (user.role === 'supermarket') {
        const supermarketId = await profileService.supermarketIdForUser(user)
        if (!supermarketId || p.paymentJob?.supermarketId !== supermarketId) {
          return res.status(404).json({ message: 'Pagamento não encontrado.' })
        }
      } else if (user.role !== 'admin') {
        return res.status(404).json({ message: 'Pagamento não encontrado.' })
      }
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

  // POST /invoices/:id/sync-payment (supermarket) — confirma o pagamento consultando o gateway
  async invoiceSyncPayment(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      return res.json(await paymentService.syncInvoicePayment(req.params.id, supermarketId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /invoices/:id/mark-paid (agency) — baixa manual quando o pagamento pelo app está desligado
  async invoiceMarkPaid(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await paymentService.markInvoicePaidByAgency(req.params.id, agencyId))
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
