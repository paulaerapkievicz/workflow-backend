import { Response } from 'express'
import { Op } from 'sequelize'
import { AuthRequest } from '../middlewares/auth'
import { profileService } from '../services/profileService'
import { Order } from '../models/Order'
import { Freelancer } from '../models/Freelancer'
import { FreelancerContract } from '../models/FreelancerContract'
import { UniformOrder } from '../models/UniformOrder'

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

      const freelancers = await Freelancer.findAll({ where: { agencyId }, attributes: ['id'] })
      const ids = freelancers.map((f) => f.id)
      if (!ids.length) {
        return res.json({ uniformsToShip: 0, selfiesToReview: 0, contractsPending: 0, registrationsToApprove })
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
      })
    } catch (error) {
      return res.status(500).json({ message: error instanceof Error ? error.message : 'Erro.' })
    }
  },
}
