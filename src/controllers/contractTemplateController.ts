import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import { profileService } from '../services/profileService'
import { contractTemplateService } from '../services/contractTemplateService'
import { contractMergeService, CONTRACT_TOKENS } from '../services/contractMergeService'
import { Freelancer } from '../models/Freelancer'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

export const contractTemplateController = {
  // GET /agency/contract-templates
  async list(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json({
        templates: await contractTemplateService.listForAgency(agencyId),
        tokens: CONTRACT_TOKENS,
      })
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /agency/contract-templates
  async create(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      const tpl = await contractTemplateService.create(agencyId, req.body ?? {}, req.user!.id)
      return res.status(201).json(tpl)
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /agency/contract-templates/:id
  async update(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await contractTemplateService.update(req.params.id, agencyId, req.body ?? {}))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /agency/contract-templates/:id/activate
  async activate(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await contractTemplateService.setActive(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // DELETE /agency/contract-templates/:id
  async remove(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      return res.json(await contractTemplateService.remove(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /agency/contract-templates/:id/preview?freelancerId=
  async preview(req: AuthRequest, res: Response) {
    try {
      const agencyId = await profileService.agencyIdForUser(req.user!)
      if (!agencyId) return res.status(403).json({ message: 'Agência não encontrada.' })
      const tpl = await contractTemplateService.getForAgency(req.params.id, agencyId)
      const freelancerId = String(req.query.freelancerId ?? '')
      let ctx: Record<string, string>
      if (freelancerId) {
        const freelancer = await Freelancer.findByPk(freelancerId)
        if (!freelancer || freelancer.agencyId !== agencyId) {
          return res.status(404).json({ message: 'Colaborador não encontrado nesta agência.' })
        }
        ctx = await contractMergeService.buildContext(freelancerId)
      } else {
        // Amostra: mostra o próprio token entre colchetes para a agência revisar o layout.
        ctx = Object.fromEntries(CONTRACT_TOKENS.map((t) => [t.token, `[${t.label}]`]))
      }
      const { html, missing } = contractMergeService.render(tpl.bodyHtml, ctx)
      return res.json({ title: tpl.title, html, missing })
    } catch (error) {
      return fail(res, error)
    }
  },
}
