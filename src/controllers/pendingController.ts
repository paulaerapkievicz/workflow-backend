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
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      const registrationsToApprove = await Freelancer.count({
        where: { agencyId, registrationStatus: 'pending' },
      })

      // Filiais que os supermercados-clientes cadastraram e ainda aguardam a agência aprovar o atendimento.
      const clientMarkets = await Supermarket.findAll({ where: { agencyId }, attributes: ['id'] })
      const marketIds = clientMarkets.map((m) => m.id)
      const branchesToApprove = marketIds.length
        ? await Branch.count({ where: { supermarketId: marketIds, serviceStatus: 'pending' } })
        : 0

      const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id'] })
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
