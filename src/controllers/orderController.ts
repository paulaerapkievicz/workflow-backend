import { Response } from 'express'
import { orderService } from '../services/orderService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
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
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(400).json({ message: 'Cadastre o supermercado antes de criar pedidos.' })
      const order = await orderService.create(req.body, supermarketId)
      return res.status(201).json(order)
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
