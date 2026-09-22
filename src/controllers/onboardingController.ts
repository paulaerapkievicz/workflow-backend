import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import { profileService } from '../services/profileService'
import { freelancerContractService } from '../services/freelancerContractService'
import { freelancerOnboardingStatusService } from '../services/freelancerOnboardingStatusService'
import { uniformService } from '../services/uniformService'
import { paymentService } from '../services/paymentService'

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

  // PUT /freelancer/contract — edição pós-ativação (o pré-cadastro em si é `submitOnboardingDocuments`)
  async saveContract(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      return res.json(await freelancerContractService.upsert(freelancer, req.body ?? {}))
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /freelancer/onboarding/documents (multipart: documentIdPhoto, addressProofPhoto,
  // documentSelfiePhoto + campos do perfil contratual) — Fase 1, pré-cadastro
  async submitOnboardingDocuments(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>
      const photoUrl = (field: string) => {
        const file = files[field]?.[0]
        return file ? `/uploads/${file.filename}` : undefined
      }
      const updated = await freelancerOnboardingStatusService.submitDocuments(freelancer, req.body ?? {}, {
        documentIdPhotoUrl: photoUrl('documentIdPhoto'),
        addressProofPhotoUrl: photoUrl('addressProofPhoto'),
        documentSelfiePhotoUrl: photoUrl('documentSelfiePhoto'),
      })
      return res.json(updated)
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

  // POST /agency/uniforms/:id/mark-paid — baixa manual (pagamento pelo app desligado)
  async markUniformPaid(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await uniformService.markPaidManually(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
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

  // GET /agency/freelancers/:id/contract — dados completos do onboarding (perfil contratual)
  async getContractForAgency(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await freelancerContractService.getForAgency(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /agency/onboarding-board — esteira com as 5 fases intermediárias do funil
  async listOnboardingBoard(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await freelancerOnboardingStatusService.listBoard(agencyId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /agency/freelancers/:id/onboarding/approve-documents — Fase 2, "Aprovar Documentos"
  async approveDocuments(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await freelancerOnboardingStatusService.approveDocuments(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /agency/freelancers/:id/onboarding/reject-documents { reason }
  async rejectDocuments(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(
        await freelancerOnboardingStatusService.rejectDocuments(req.params.id, agencyId, req.body?.reason)
      )
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /agency/freelancers/:id/onboarding/aso (multipart, campo "file") — Fase 3, anexa o ASO
  async uploadAso(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      if (!req.file) return res.status(400).json({ message: 'Envie o PDF do ASO.' })
      return res.json(
        await freelancerOnboardingStatusService.uploadAso(req.params.id, agencyId, `/uploads/${req.file.filename}`)
      )
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /agency/freelancers/:id/onboarding/release-contract — Fase 4, "Liberar Contrato"
  async releaseContract(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await freelancerOnboardingStatusService.releaseContract(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /agency/freelancers/:id/onboarding/activate — Fase 6, "Ativar Colaborador"
  async activate(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await freelancerOnboardingStatusService.activate(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /payments/mercadopago/webhook  (público)
  async mercadoPagoWebhook(req: AuthRequest, res: Response) {
    const body = req.body ?? {}
    // Um webhook só, vários domínios — cada handler ignora o que não é dele (pelo external_reference).
    try {
      await uniformService.handleWebhook(body)
    } catch (err) {
      console.error('[mercadopago webhook] uniform', err)
    }
    try {
      await paymentService.handleInvoiceWebhook(body)
    } catch (err) {
      console.error('[mercadopago webhook] invoice', err)
    }
    return res.status(200).json({ received: true })
  },
}
