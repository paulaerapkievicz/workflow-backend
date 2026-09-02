import { Response } from 'express'
import { orderService, OrderContext } from '../services/orderService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

async function requireContext(req: AuthRequest, res: Response): Promise<OrderContext | null> {
  const ctx = await profileService.supermarketContextForUser(req.user!)
  if (!ctx) {
    res.status(400).json({ message: 'Cadastre o supermercado antes de criar pedidos.' })
    return null
  }
  return { ...ctx, userId: req.user!.id }
}

export const orderController = {
  // GET /orders — escopado pelo papel
  async index(req: AuthRequest, res: Response) {
    try {
      return res.json(await orderService.listForUser(req.user!))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /orders/:id
  async show(req: AuthRequest, res: Response) {
    try {
      const order = await orderService.findById(req.params.id)
      if (!order) return res.status(404).json({ message: 'Pedido não encontrado.' })
      if (req.user!.role === 'supermarket') {
        const supermarketId = await profileService.supermarketIdForUser(req.user!)
        if (order.supermarketId !== supermarketId) {
          return res.status(403).json({ message: 'Pedido não pertence ao seu supermercado.' })
        }
      }
      return res.json(order)
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /orders (supermarket) — carrinho de vagas
  async create(req: AuthRequest, res: Response) {
    try {
      const ctx = await requireContext(req, res)
      if (!ctx) return
      const order = await orderService.create(req.body, ctx)
      return res.status(201).json(order)
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /orders/:id/items (supermarket) — adiciona vagas a um pedido já enviado
  async addItems(req: AuthRequest, res: Response) {
    try {
      const ctx = await requireContext(req, res)
      if (!ctx) return
      return res.status(201).json(await orderService.addItems(req.params.id, req.body?.items, ctx))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /orders/:id/approve (supermarket — quem tem permissão)
  async approve(req: AuthRequest, res: Response) {
    try {
      const ctx = await requireContext(req, res)
      if (!ctx) return
      return res.json(await orderService.approve(req.params.id, ctx))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /orders/:id/reject (supermarket — quem tem permissão)
  async reject(req: AuthRequest, res: Response) {
    try {
      const ctx = await requireContext(req, res)
      if (!ctx) return
      return res.json(await orderService.reject(req.params.id, ctx, req.body?.reason))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /orders/:id/cancel (supermarket)
  async cancel(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      return res.json(await orderService.cancel(req.params.id, supermarketId))
    } catch (error) {
      return fail(res, error)
    }
  },
}
