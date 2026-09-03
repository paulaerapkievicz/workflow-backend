// src/controllers/jobController.ts

import { Response } from 'express'
import { jobService } from '../services/jobService'
import { reviewService } from '../services/reviewService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

export const jobController = {
  // GET /jobs — escopado pelo papel
  async index(req: AuthRequest, res: Response) {
    try {
      const jobs = await jobService.listForUser(req.user!)
      return res.json(jobs)
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /jobs/available — vagas abertas (freelancer)
  async available(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      return res.json(await jobService.availableForFreelancer(freelancer))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /jobs/live — vagas em andamento (agência: sua rede; supermercado: suas lojas)
  async live(req: AuthRequest, res: Response) {
    try {
      if (req.user!.role === 'supermarket') {
        const ctx = await profileService.supermarketContextForUser(req.user!)
        if (!ctx) return res.status(403).json({ message: 'Supermercado não encontrado.' })
        return res.json(await jobService.liveForSupermarket(ctx.supermarketId, ctx.branchId))
      }
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await jobService.liveForAgency(agencyId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /jobs/:id
  async show(req: AuthRequest, res: Response) {
    try {
      const job = await jobService.findById(req.params.id)
      if (!job) return res.status(404).json({ message: 'Vaga não encontrada.' })
      return res.json(job)
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /jobs (supermarket)
  async create(req: AuthRequest, res: Response) {
    try {
      const ctx = await profileService.supermarketContextForUser(req.user!)
      if (!ctx) return res.status(400).json({ message: 'Cadastre o supermercado antes de criar vagas.' })
      const job = await jobService.create(req.body, { ...ctx, userId: req.user!.id })
      return res.status(201).json(job)
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /jobs/:id (supermarket)
  async update(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      return res.json(await jobService.update(req.params.id, req.body, supermarketId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /agency/jobs/:id (agency) — gerencia função/turno (pendente) e overrides de configuração
  async updateByAgency(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await jobService.updateByAgency(req.params.id, agencyId, req.body ?? {}))
    } catch (error) {
      return fail(res, error)
    }
  },

  // DELETE /jobs/:id (supermarket)
  async delete(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      return res.json(await jobService.remove(req.params.id, supermarketId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /jobs/:id/cancel (supermarket)
  async cancel(req: AuthRequest, res: Response) {
    try {
      const supermarketId = await profileService.supermarketIdForUser(req.user!)
      if (!supermarketId) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      return res.json(await jobService.cancel(req.params.id, supermarketId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /jobs/:id/accept (freelancer)
  async accept(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de freelancer não encontrado.' })
      return res.json(await jobService.accept(req.params.id, freelancer))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /jobs/:id/withdraw (freelancer) — desiste da vaga dentro do prazo
  async withdraw(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de freelancer não encontrado.' })
      return res.json(await jobService.withdrawByFreelancer(req.params.id, freelancer, req.body?.reason))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /jobs/:id/release (agency) — libera a vaga de um freelancer para repassar/reabrir
  async release(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await jobService.releaseByAgency(req.params.id, agencyId, req.body?.reason))
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /agency/pending-settlement (agency) — vagas concluídas com pagamento retido (hora extra)
  async pendingSettlement(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await jobService.pendingSettlementForAgency(agencyId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /jobs/:id/release-payment (agency) — libera o pagamento de uma vaga retida
  async releasePayment(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      const capToContracted = req.body?.capToContracted === true || req.body?.capToContracted === 'true'
      return res.json(await jobService.releasePayment(req.params.id, agencyId, capToContracted))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /jobs/:id/no-show (agency) — registra falta do freelancer da rede
  async noShow(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await jobService.registerNoShow(req.params.id, agencyId, req.body.reason))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /jobs/:id/review (agency) — avaliação da entrega (reputação)
  async review(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      const review = await reviewService.createDeliveryReview(req.params.id, agencyId, {
        rating: Number(req.body.rating),
        comment: req.body.comment,
        approved: req.body.approved !== false,
      })
      return res.status(201).json(review)
    } catch (error) {
      return fail(res, error)
    }
  },
}
