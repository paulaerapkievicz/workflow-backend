import { Response } from 'express'
import { Op } from 'sequelize'
import { AuthRequest } from '../middlewares/auth'
import { profileService } from '../services/profileService'
import { Order } from '../models/Order'
import { Freelancer } from '../models/Freelancer'
import { FreelancerContract } from '../models/FreelancerContract'
import { UniformOrder } from '../models/UniformOrder'
import { Supermarket } from '../models/Supermarket'
import { Branch } from '../models/Branch'

export const pendingController = {
  // GET /supermarket/pending-counts
  async supermarket(req: AuthRequest, res: Response) {
    try {
      const ctx = await profileService.supermarketContextForUser(req.user!)
      if (!ctx) return res.json({ ordersToApprove: 0 })
      const ordersToApprove = ctx.canApproveOrders
        ? await Order.count({
            where: { supermarketId: ctx.supermarketId, approvalStatus: 'pending_approval' },
          })
        : 0
      return res.json({ ordersToApprove })
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro.' })
    }
  },

  // GET /agency/pending-counts
  async agency(req: AuthRequest, res: Response) {
    try {
      const actor = await profileService.agencyContextForUser(req.user!)
      if (!actor) return res.status(403).json({ message: 'Agência não encontrada.' })
      const agencyId = actor.agencyId

      const regWhere: any = { agencyId, registrationStatus: 'pending' }
      if (actor.scopeFreelancerIds) regWhere.id = actor.scopeFreelancerIds
      const registrationsToApprove = await Freelancer.count({ where: regWhere })

      // Filiais que os supermercados-clientes cadastraram e ainda aguardam a agência aprovar o atendimento.
      // Líder não aprova filial (rota é dono-only) — não conta pra ele.
      let branchesToApprove = 0
      if (actor.isOwner) {
        const clientMarkets = await Supermarket.findAll({ where: { agencyId }, attributes: ['id'] })
        const marketIds = clientMarkets.map((m) => m.id)
        branchesToApprove = marketIds.length
          ? await Branch.count({ where: { supermarketId: marketIds, serviceStatus: 'pending' } })
          : 0
      }

      const scopeWhere: any = { agencyId }
      if (actor.scopeFreelancerIds) scopeWhere.id = actor.scopeFreelancerIds
      const freelancers = await Freelancer.findAll({ where: scopeWhere, attributes: ['id'] })
      const ids = freelancers.map((f) => f.id)
      if (!ids.length) {
        return res.json({
          uniformsToShip: 0,
          selfiesToReview: 0,
          contractsPending: 0,
          registrationsToApprove,
          branchesToApprove,
        })
      }

      const [uniformsToShip, selfiesToReview, contractsDone] = await Promise.all([
        UniformOrder.count({ where: { freelancerId: ids, status: 'paid' } }),
        UniformOrder.count({ where: { freelancerId: ids, status: 'photo_submitted' } }),
        FreelancerContract.count({ where: { freelancerId: ids, completedAt: { [Op.ne]: null } } }),
      ])
      return res.json({
        uniformsToShip,
        selfiesToReview,
        contractsPending: Math.max(0, ids.length - contractsDone),
        registrationsToApprove,
        branchesToApprove,
      })
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro.' })
    }
  },
}
