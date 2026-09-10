import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import { profileService } from '../services/profileService'
import {
  freelancerContractSignatureService,
  ACCEPTANCE_TEXT,
} from '../services/freelancerContractSignatureService'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

function frontendBaseUrl(): string | undefined {
  return (process.env.FRONTEND_BASE_URL || '').split(',').map((s) => s.trim()).filter(Boolean)[0]
}

export const contractSignatureController = {
  // GET /freelancer/contract/agreement
  async myAgreement(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      const data = await freelancerContractSignatureService.agreementFor(freelancer)
      return res.json({ ...data, acceptanceText: ACCEPTANCE_TEXT })
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /freelancer/contract/sign  { accepted, signerName?, signerCpf? }
  async sign(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      if (req.body?.accepted !== true) {
        return res.status(400).json({ message: 'Marque a confirmação de aceite para assinar o contrato.' })
      }
      const signature = await freelancerContractSignatureService.sign(freelancer, {
        signerName: req.body?.signerName,
        signerCpf: req.body?.signerCpf,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        baseUrl: frontendBaseUrl(),
      })
      return res.status(201).json(signature)
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /freelancer/contract/document
  async myDocument(req: AuthRequest, res: Response) {
    try {
      const freelancer = await profileService.freelancerForUser(req.user!)
      if (!freelancer) return res.status(400).json({ message: 'Perfil de colaborador não encontrado.' })
      const current = await freelancerContractSignatureService.currentForFreelancer(freelancer.id)
      if (!current) return res.status(404).json({ message: 'Nenhum contrato assinado.' })
      const { path, filename } = await freelancerContractSignatureService.documentFor(
        { freelancerId: freelancer.id },
        current.id
      )
      return res.download(path, filename)
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /agency/contract-signatures
  async agencyList(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await freelancerContractSignatureService.listForAgency(agencyId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /agency/contract-signatures/:id/document
  async agencyDocument(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      const { path, filename } = await freelancerContractSignatureService.documentFor(
        { agencyId },
        req.params.id
      )
      return res.download(path, filename)
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /contracts/verify/:id  (público)
  async verify(req: AuthRequest, res: Response) {
    try {
      return res.json(await freelancerContractSignatureService.verify(req.params.id))
    } catch (error) {
      return fail(res, error, 404)
    }
  },
}
