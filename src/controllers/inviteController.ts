import { Response } from 'express'
import { Request } from 'express'
import { inviteService } from '../services/inviteService'
import { profileService } from '../services/profileService'
import { AuthRequest } from '../middlewares/auth'

export const inviteController = {
  // POST /agency/invites — a agência gera um link de convite (supermercado ou freelancer)
  async create(req: AuthRequest, res: Response) {
    try {
      const ctx = await profileService.agencyContextForUser(req.user!)
      if (!ctx) return res.status(403).json({ message: 'Agência não encontrada.' })
      const invite = await inviteService.create(ctx.agencyId, req.body?.role, {
        callerRole: req.user!.role as 'agency' | 'leader' | 'partner',
        payType: req.body?.payType ?? null,
        payAmount: req.body?.payAmount ?? null,
      })
      return res.status(201).json({ token: invite.token, role: invite.role })
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : 'Erro ao gerar convite.' })
    }
  },

  // GET /invites/:token — público, só o essencial pra montar o formulário de autocadastro
  async show(req: Request, res: Response) {
    try {
      const invite = await inviteService.findActiveByToken(req.params.token)
      const agency = (invite as any).inviteAgency
      return res.json({ agencyName: agency?.name ?? null, role: invite.role, status: invite.status })
    } catch (error) {
      return res.status(404).json({ message: error instanceof Error ? error.message : 'Convite não encontrado.' })
    }
  },
}
