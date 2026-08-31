import { NextFunction, Request, Response } from 'express'
import { jwtService } from '../services/jwtService'
import { User, UserInstance } from '../models/User'

export type Role = 'admin' | 'supermarket' | 'freelancer' | 'agency'

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
