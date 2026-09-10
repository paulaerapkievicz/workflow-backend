import { Transaction } from 'sequelize'
import { TeamRole, TeamRoleScope } from '../models/TeamRole'

/** Cargos oferecidos de fábrica quando um supermercado / agência é criado. */
export const DEFAULT_SUPERMARKET_ROLES = ['Administrador', 'Gerente', 'RH', 'Financeiro', 'Comprador']
export const DEFAULT_AGENCY_ROLES = ['Administrador', 'Gerente', 'RH', 'Operações', 'Comercial']

function normalizeName(raw: unknown): string {
  const name = String(raw ?? '').trim()
  if (!name) throw new Error('Informe o nome do cargo.')
  if (name.length > 40) throw new Error('O nome do cargo é muito longo (máx. 40 caracteres).')
  return name
}

export const teamRoleService = {
  /** Cria a lista padrão de cargos. Devolve os cargos criados. */
  async seedDefaults(scope: TeamRoleScope, ownerId: string, t?: Transaction) {
    const names = scope === 'supermarket' ? DEFAULT_SUPERMARKET_ROLES : DEFAULT_AGENCY_ROLES
    const rows = names.map((name, position) => ({ scope, ownerId, name, position }))
    return TeamRole.bulkCreate(rows, { transaction: t })
  },

  async listFor(scope: TeamRoleScope, ownerId: string) {
    return TeamRole.findAll({
      where: { scope, ownerId },
      order: [['position', 'ASC'], ['name', 'ASC']],
    })
  },

  async create(scope: TeamRoleScope, ownerId: string, rawName: unknown) {
    const name = normalizeName(rawName)
    const dup = await TeamRole.findOne({ where: { scope, ownerId, name } })
    if (dup) throw new Error('Já existe um cargo com esse nome.')
    const last = await TeamRole.findOne({ where: { scope, ownerId }, order: [['position', 'DESC']] })
    return TeamRole.create({ scope, ownerId, name, position: (last?.position ?? -1) + 1 })
  },

  async update(id: string, scope: TeamRoleScope, ownerId: string, data: { name?: unknown; position?: unknown }) {
    const role = await TeamRole.findOne({ where: { id, scope, ownerId } })
    if (!role) throw new Error('Cargo não encontrado.')
    const patch: Record<string, unknown> = {}
    if (data.name !== undefined) {
      const name = normalizeName(data.name)
      const dup = await TeamRole.findOne({ where: { scope, ownerId, name } })
      if (dup && dup.id !== id) throw new Error('Já existe um cargo com esse nome.')
      patch.name = name
    }
    if (data.position !== undefined && Number.isFinite(Number(data.position))) {
      patch.position = Number(data.position)
    }
    await role.update(patch)
    return role
  },

  async remove(id: string, scope: TeamRoleScope, ownerId: string) {
    const role = await TeamRole.findOne({ where: { id, scope, ownerId } })
    if (!role) throw new Error('Cargo não encontrado.')
    // O ON DELETE SET NULL do banco solta os membros que usavam este cargo.
    await role.destroy()
    return { message: 'Cargo removido.' }
  },

  /** Valida que o cargo (quando informado) pertence à lista do dono. Devolve o id ou null. */
  async resolveId(
    teamRoleId: unknown,
    scope: TeamRoleScope,
    ownerId: string,
    t?: Transaction
  ): Promise<string | null> {
    if (teamRoleId === undefined || teamRoleId === null || teamRoleId === '') return null
    const role = await TeamRole.findOne({
      where: { id: String(teamRoleId), scope, ownerId },
      transaction: t,
    })
    if (!role) throw new Error('Cargo inválido para esta equipe.')
    return role.id
  },

  /** id do cargo "Administrador" da lista (usado para marcar o dono/administrador). */
  async adminRoleId(scope: TeamRoleScope, ownerId: string, t?: Transaction): Promise<string | null> {
    const role = await TeamRole.findOne({
      where: { scope, ownerId, name: 'Administrador' },
      transaction: t,
    })
    return role?.id ?? null
  },

  serialize(role: { id: string; name: string; position: number } | null | undefined) {
    return role ? { id: role.id, name: role.name, position: role.position } : null
  },
}
