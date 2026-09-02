import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import { profileService } from '../services/profileService'
import { freelancerContractService } from '../services/freelancerContractService'
import { uniformService } from '../services/uniformService'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

export const onboardingController = {
  // GET /freelancer/contract
  async getContract(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      return res.json(await freelancerContractService.getForFreelancer(freelancer.id))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // PUT /freelancer/contract
  async saveContract(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      return res.json(await freelancerContractService.upsert(freelancer, req.body ?? {}))
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /freelancer/uniform
  async getUniform(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      return res.json(await uniformService.currentForFreelancer(freelancer.id))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /freelancer/uniform { shirtSize }
  async requestUniform(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      const order = await uniformService.request(freelancer, String(req.body?.shirtSize ?? ''))
      return res.status(201).json(order)
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /freelancer/uniform/:id/sync  — confirma o pagamento consultando o Mercado Pago
  async syncUniform(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      return res.json(await uniformService.syncPaymentStatus(freelancer.id, req.params.id))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /freelancer/uniform/:id/received
  async confirmReceived(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      return res.json(await uniformService.markReceived(req.params.id, freelancer))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /freelancer/uniform/:id/selfie  (multipart, campo "photo")
  async submitSelfie(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      if (!req.file) return res.status(400).json({ message: 'Envie a foto de uniforme.' })
      return res.json(
        await uniformService.submitSelfie(req.params.id, freelancer, `/uploads/${req.file.filename}`)
      )
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /agency/uniforms
  async listForAgency(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await uniformService.listForAgency(agencyId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /agency/uniforms/:id/ship { trackingCode? }
  async shipUniform(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await uniformService.markShipped(req.params.id, agencyId, req.body?.trackingCode))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /agency/uniforms/:id/review { approved, reason? }
  async reviewUniform(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(
        await uniformService.review(req.params.id, agencyId, {
          approved: req.body?.approved === true,
          reason: req.body?.reason,
        })
      )
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /payments/mercadopago/webhook  (público)
  async mercadoPagoWebhook(req: AuthRequest, res: Response) {
    try {
      await uniformService.handleWebhook(req.body ?? {})
    } catch (err) {
      console.error('[mercadopago webhook]', err)
    }
    return res.status(200).json({ received: true })
  },
}
