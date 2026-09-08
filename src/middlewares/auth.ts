import { NextFunction, Request, Response } from 'express'
import { jwtService } from '../services/jwtService'
import { User, UserInstance } from '../models/User'
import { profileService } from '../services/profileService'

export type Role = 'admin' | 'supermarket' | 'freelancer' | 'agency' | 'leader'

export interface AuthRequest extends Request {
  user?: UserInstance
}

export async function ensureAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization

  if (!header) {
    return res.status(401).json({ message: 'Não autorizado: token não informado.' })
  }

  const token = header.replace(/^Bearer\s+/i, '')

  try {
    const payload = await jwtService.verify(token)
    const user = await User.findByPk(payload.sub)

    if (!user) {
      return res.status(401).json({ message: 'Não autorizado: usuário não encontrado.' })
    }

    req.user = user
    return next()
  } catch {
    return res.status(401).json({ message: 'Não autorizado: token inválido ou expirado.' })
  }
}

/**
 * Restringe as rotas de faturamento/fatura para o supermercado. O dono sempre passa; o
 * gerente de loja só com a permissão pedida (`view` = só leitura; `pay` = pagar/contestar).
 * Os demais papéis (agência, admin) passam direto — o escopo deles é checado nos controllers.
 */
function ensureInvoicePermission(kind: 'view' | 'pay') {
  const messages = {
    view: 'Você não tem permissão para ver as faturas da rede.',
    pay: 'Você não tem permissão para pagar as faturas da rede.',
  }
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'Não autorizado.' })
    if (req.user.role !== 'supermarket') return next()
    try {
      const ctx = await profileService.supermarketContextForUser(req.user)
      if (!ctx) return res.status(403).json({ message: 'Supermercado não encontrado.' })
      const allowed = ctx.isOwner || (kind === 'view' ? ctx.canViewInvoices : ctx.canPayInvoices)
      if (!allowed) return res.status(403).json({ message: messages[kind] })
      return next()
    } catch {
      return res.status(500).json({ message: 'Erro ao verificar permissão.' })
    }
  }
}

export const ensureCanViewInvoices = ensureInvoicePermission('view')
export const ensureCanPayInvoices = ensureInvoicePermission('pay')

export function authorize(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado.' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Acesso negado para o seu perfil.' })
    }
    return next()
  }
}
