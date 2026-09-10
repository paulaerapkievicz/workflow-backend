import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import { agencyService } from '../services/agencyService'
import { Agency } from '../models/Agency'
import { User } from '../models/User'
import { Freelancer } from '../models/Freelancer'
import { Supermarket } from '../models/Supermarket'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

export const adminAgencyController = {
  // GET /admin/agencies
  async index(_req: AuthRequest, res: Response) {
    try {
      const agencies = await Agency.findAll({
        order: [['name', 'ASC']],
        include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
      })
      const withCounts = await Promise.all(
        agencies.map(async (a) => ({
          ...a.toJSON(),
          freelancerCount: await Freelancer.count({ where: { agencyId: a.id } }),
          supermarketCount: await Supermarket.count({ where: { agencyId: a.id } }),
        }))
      )
      return res.json(withCounts)
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // GET /admin/agencies/:id
  async show(req: AuthRequest, res: Response) {
    try {
      const agency = await Agency.findByPk(req.params.id, {
        include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
      })
      if (!agency) return res.status(404).json({ message: 'Agência não encontrada.' })
      return res.json(agency)
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /admin/agencies — cria a agência + o login do dono
  async create(req: AuthRequest, res: Response) {
    try {
      const b = req.body ?? {}
      const { agency, owner } = await agencyService.createWithOwner({
        name: b.name,
        legalName: b.legalName,
        cnpj: b.cnpj,
        address: b.address,
        phone: b.phone,
        email: b.email,
        ownerName: b.ownerName || b.name,
        ownerEmail: b.ownerEmail,
        password: b.password,
        commissionPercentage: b.commissionPercentage,
      })
      return res.status(201).json({ agency, owner: { id: owner.id, name: owner.name, email: owner.email } })
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /admin/agencies/:id — perfil + ativar/desativar
  async update(req: AuthRequest, res: Response) {
    try {
      const updated = await agencyService.adminUpdate(req.params.id, req.body ?? {})
      return res.json(updated)
    } catch (error) {
      return fail(res, error)
    }
  },
}
