import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import { profileService } from '../services/profileService'
import { agencyMemberService } from '../services/agencyMemberService'
import { leaderJobCreditService } from '../services/leaderJobCreditService'
import { AgencyMemberJobCreditStatus } from '../models/AgencyMemberJobCredit'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

/** Só o dono da agência gerencia líderes — as rotas usam authorize('agency'). */
async function ownerAgencyId(req: AuthRequest, res: Response): Promise<string | null> {
  const agencyId = await profileService.agencyIdForUser(req.user!)
  if (!agencyId) {
    res.status(403).json({ message: 'Agência não encontrada.' })
    return null
  }
  return agencyId
}

export const agencyMemberController = {
  // GET /agency/members
  async index(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.json(await agencyMemberService.list(agencyId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /agency/members
  async create(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.status(201).json(await agencyMemberService.createDirect(agencyId, req.body ?? {}))
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /agency/members/:id
  async update(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.json(await agencyMemberService.update(req.params.id, agencyId, req.body ?? {}))
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /agency/members/:id/scope
  async setScope(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      const freelancerIds: string[] = Array.isArray(req.body?.freelancerIds) ? req.body.freelancerIds : []
      const branchIds: string[] = Array.isArray(req.body?.branchIds) ? req.body.branchIds : []
      return res.json(await agencyMemberService.setScope(req.params.id, agencyId, freelancerIds, branchIds))
    } catch (error) {
      return fail(res, error)
    }
  },

  // DELETE /agency/members/:id — desativa (mantém histórico e carteira)
  async remove(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.json(await agencyMemberService.deactivate(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /agency/members/:id/payments — credita a carteira do líder (debita o saldo da agência)
  async registerPayment(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      const member = await agencyMemberService.registerPayment(req.params.id, agencyId, req.user!.id, {
        amount: req.body?.amount,
        referenceMonth: req.body?.referenceMonth ?? null,
        note: req.body?.note ?? null,
      })
      return res.status(201).json(member)
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /leader/wallet — carteira do próprio líder
  async myWallet(req: AuthRequest, res: Response) {
    try {
      return res.json(await agencyMemberService.walletForUser(req.user!.id))
    } catch (error) {
      return fail(res, error)
    }
  },

  // GET /agency/member-credits?status=pending — créditos "por colaborador que trabalhou"
  async jobCredits(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      const raw = String(req.query.status ?? '')
      const status = (['released', 'pending', 'canceled'] as AgencyMemberJobCreditStatus[]).includes(
        raw as AgencyMemberJobCreditStatus
      )
        ? (raw as AgencyMemberJobCreditStatus)
        : undefined
      return res.json(await leaderJobCreditService.listForAgency(agencyId, status))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /agency/member-credits/:id/release — a agência decide pagar o crédito pendente
  async releaseJobCredit(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.json(await leaderJobCreditService.release(req.params.id, agencyId))
    } catch (error) {
      return fail(res, error)
    }
  },

  // POST /agency/member-credits/:id/cancel — a agência decide não pagar o crédito
  async cancelJobCredit(req: AuthRequest, res: Response) {
    try {
      const agencyId = await ownerAgencyId(req, res)
      if (!agencyId) return
      return res.json(await leaderJobCreditService.cancel(req.params.id, agencyId, req.body?.note ?? null))
    } catch (error) {
      return fail(res, error)
    }
  },
}
