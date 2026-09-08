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
 * Restringe as rotas de faturamento/fatura para o supermercado: o dono sempre passa,
 * o gerente de loja só quando tem `canViewInvoices`. Os demais papéis (agência, admin)
 * passam direto — o escopo deles é checado nos controllers.
 */
export async function ensureCanViewInvoices(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: 'Não autorizado.' })
  if (req.user.role !== 'supermarket') return next()
  try {
    const ctx = await profileService.supermarketContextForUser(req.user)
    if (!ctx) return res.status(403).json({ message: 'Supermercado não encontrado.' })
    if (!ctx.isOwner && !ctx.canViewInvoices) {
      return res.status(403).json({ message: 'Você não tem permissão para ver as faturas da rede.' })
    }
    return next()
  } catch {
    return res.status(500).json({ message: 'Erro ao verificar permissão.' })
  }
}

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
