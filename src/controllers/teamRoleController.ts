import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth'
import { profileService } from '../services/profileService'
import { teamRoleService } from '../services/teamRoleService'
import { TeamRoleScope } from '../models/TeamRole'
import { Supermarket } from '../models/Supermarket'

function fail(res: Response, err: unknown, code = 400) {
  return res.status(code).json({ message: err instanceof Error ? err.message : 'Erro inesperado.' })
}

/**
 * Resolve de quem é a lista de cargos:
 * - supermercado (só o dono): a própria lista da rede;
 * - agência: a lista da própria agência (líderes) OU, com `?supermarketId=` de um cliente,
 *   a lista daquele supermercado (a agência gerencia a equipe do cliente).
 * Líder de agência e gerente de loja não gerenciam cargos.
 */
async function ownerScope(
  req: AuthRequest,
  res: Response
): Promise<{ scope: TeamRoleScope; ownerId: string } | null> {
  if (req.user!.role === 'supermarket') {
    const ctx = await profileService.supermarketContextForUser(req.user!)
    if (!ctx || !ctx.isOwner) {
      res.status(403).json({ message: 'Somente o responsável pela rede gerencia os cargos.' })
      return null
    }
    return { scope: 'supermarket', ownerId: ctx.supermarketId }
  }
  if (req.user!.role === 'agency') {
    const agencyId = await profileService.agencyIdForUser(req.user!)
    if (!agencyId) {
      res.status(403).json({ message: 'Agência não encontrada.' })
      return null
    }
    const supermarketId = (req.query.supermarketId ?? req.body?.supermarketId) as string | undefined
    if (supermarketId) {
      const market = await Supermarket.findByPk(supermarketId)
      if (!market || market.agencyId !== agencyId) {
        res.status(403).json({ message: 'Este supermercado não é cliente da sua agência.' })
        return null
      }
      return { scope: 'supermarket', ownerId: market.id }
    }
    return { scope: 'agency', ownerId: agencyId }
  }
  res.status(403).json({ message: 'Acesso negado para o seu perfil.' })
  return null
}

export const teamRoleController = {
  // GET /team-roles
  async index(req: AuthRequest, res: Response) {
    try {
      const owner = await ownerScope(req, res)
      if (!owner) return
      return res.json(await teamRoleService.listFor(owner.scope, owner.ownerId))
    } catch (error) {
      return fail(res, error, 500)
    }
  },

  // POST /team-roles
  async create(req: AuthRequest, res: Response) {
    try {
      const owner = await ownerScope(req, res)
      if (!owner) return
      return res.status(201).json(await teamRoleService.create(owner.scope, owner.ownerId, req.body?.name))
    } catch (error) {
      return fail(res, error)
    }
  },

  // PUT /team-roles/:id
  async update(req: AuthRequest, res: Response) {
    try {
      const owner = await ownerScope(req, res)
      if (!owner) return
      return res.json(
        await teamRoleService.update(req.params.id, owner.scope, owner.ownerId, {
          name: req.body?.name,
          position: req.body?.position,
        })
      )
    } catch (error) {
      return fail(res, error)
    }
  },

  // DELETE /team-roles/:id
  async remove(req: AuthRequest, res: Response) {
    try {
      const owner = await ownerScope(req, res)
      if (!owner) return
      return res.json(await teamRoleService.remove(req.params.id, owner.scope, owner.ownerId))
    } catch (error) {
      return fail(res, error)
    }
  },
}
