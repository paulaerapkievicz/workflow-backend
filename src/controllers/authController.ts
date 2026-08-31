import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { sequelize } from '../database'
import { User } from '../models/User'
import { Supermarket } from '../models/Supermarket'
import { Agency } from '../models/Agency'
import { Freelancer } from '../models/Freelancer'
import { Commission } from '../models/Commission'
import { jwtService } from '../services/jwtService'
import { profileService } from '../services/profileService'
import { AuthRequest, Role } from '../middlewares/auth'

const VALID_ROLES: Role[] = ['admin', 'supermarket', 'freelancer', 'agency']

function publicUser(user: User) {
  const json = (user as any).toJSON ? (user as any).toJSON() : user
  delete json.passwordHash
  return json
}

export const authController = {
  // POST /auth/register
  async register(req: Request, res: Response) {
    const { name, email, password, phone, role } = req.body ?? {}
    const profile = req.body?.profile ?? {}

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Informe nome, e-mail, senha e perfil.' })
    }
    if (!VALID_ROLES.includes(role) || role === 'admin') {
      return res.status(400).json({ message: 'Perfil inválido para cadastro.' })
    }

    const exists = await User.findOne({ where: { email } })
    if (exists) {
      return res.status(409).json({ message: 'Este e-mail já está cadastrado.' })
    }

    if ((role === 'supermarket' || role === 'agency') && (!profile.companyName || !profile.cnpj || !profile.address)) {
      return res.status(400).json({ message: 'Informe nome da empresa, CNPJ e endereço.' })
    }

    try {
      const result = await sequelize.transaction(async (t) => {
        const passwordHash = await bcrypt.hash(password, 10)
        const user = await User.create({ name, email, passwordHash, role, phone: phone ?? null }, { transaction: t })

        let createdProfile: any = null

        if (role === 'supermarket') {
          createdProfile = await Supermarket.create(
            { ownerId: user.id, name: profile.companyName, cnpj: profile.cnpj, address: profile.address, phone: phone ?? undefined },
            { transaction: t }
          )
        } else if (role === 'agency') {
          const pct = profile.commissionPercentage != null ? Number(profile.commissionPercentage) : 10
          createdProfile = await Agency.create(
            { ownerId: user.id, name: profile.companyName, cnpj: profile.cnpj, address: profile.address, phone: phone ?? undefined, commissionPercentage: pct },
            { transaction: t }
          )
          await Commission.create({ agencyId: createdProfile.id, percentage: pct }, { transaction: t })
        } else if (role === 'freelancer') {
          createdProfile = await Freelancer.create(
            {
              userId: user.id,
              agencyId: profile.agencyId ?? null,
              name,
              email,
              phone: phone ?? undefined,
              skills: profile.skills ?? undefined,
            },
            { transaction: t }
          )
        }

        return { user, profile: createdProfile }
      })

      const token = jwtService.sign({ sub: result.user.id, role: result.user.role, email: result.user.email })
      return res.status(201).json({ token, user: publicUser(result.user), profile: result.profile })
    } catch (err) {
      return res.status(400).json({ message: err instanceof Error ? err.message : 'Erro ao cadastrar.' })
    }
  },

  // POST /auth/login
  async login(req: Request, res: Response) {
    const { email, password } = req.body ?? {}
    if (!email || !password) {
      return res.status(400).json({ message: 'Informe e-mail e senha.' })
    }

    const user = await User.findOne({ where: { email } })
    if (!user) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' })
    }

    const token = jwtService.sign({ sub: user.id, role: user.role, email: user.email })
    const profile = await profileService.forUser(user)
    return res.json({ token, user: publicUser(user), profile })
  },

  // GET /auth/me
  async me(req: AuthRequest, res: Response) {
    const user = req.user!
    const profile = await profileService.forUser(user)
    return res.json({ user: publicUser(user), profile })
  },
}
