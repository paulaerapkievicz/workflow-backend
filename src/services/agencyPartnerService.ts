import bcrypt from 'bcrypt'
import { sequelize } from '../database'
import { User } from '../models/User'
import { AgencyPartner } from '../models/AgencyPartner'
import { TeamRole } from '../models/TeamRole'
import { teamRoleService } from './teamRoleService'
import { assertField } from '../helpers/validation'
import { AgencyPartnerPermissions, sanitizePartnerPermissions, defaultPartnerPermissions } from '../helpers/agencyPartnerPermissions'
import { resolveLoginEmail, emailAlreadyRegistered } from '../helpers/loginCredentials'
import { passwordResetService } from './passwordResetService'

async function serialize(partner: AgencyPartner & { id: string }) {
  const [user, teamRole] = await Promise.all([
    User.findByPk(partner.userId, { attributes: ['id', 'name', 'email', 'phone'] }),
    partner.teamRoleId ? TeamRole.findByPk(partner.teamRoleId) : Promise.resolve(null),
  ])
  return {
    id: partner.id,
    agencyId: partner.agencyId,
    userId: partner.userId,
    name: user?.name ?? null,
    email: user?.email ?? null,
    phone: user?.phone ?? null,
    active: partner.active,
    teamRoleId: partner.teamRoleId ?? null,
    teamRole: teamRoleService.serialize(teamRole),
    permissions: sanitizePartnerPermissions(partner.permissions),
  }
}

export const agencyPartnerService = {
  async list(agencyId: string) {
    const partners = await AgencyPartner.findAll({ where: { agencyId }, order: [['createdAt', 'ASC']] })
    return Promise.all(partners.map((p) => serialize(p)))
  },

  async get(id: string, agencyId: string) {
    const partner = await AgencyPartner.findOne({ where: { id, agencyId } })
    if (!partner) throw new Error('Sócio não encontrado.')
    return serialize(partner)
  },

  /** A agência redefine a senha do sócio pra caso ele não consiga recuperar sozinho. */
  async resetPassword(id: string, agencyId: string) {
    const partner = await AgencyPartner.findOne({ where: { id, agencyId } })
    if (!partner) throw new Error('Sócio não encontrado.')
    return passwordResetService.resetForUser(partner.userId)
  },

  /** Cria o sócio direto (login + AgencyPartner), sem passar por convite. Acesso total por padrão. */
  async createDirect(
    agencyId: string,
    data: {
      name?: string
      email?: string
      password?: string
      phone?: string
      teamRoleId?: unknown
      permissions?: unknown
    }
  ) {
    const { name, password } = data
    if (!name || !data.email || !password) {
      throw new Error('Informe nome, e-mail e senha do sócio.')
    }
    if (String(password).length < 6) throw new Error('A senha do sócio precisa ter ao menos 6 caracteres.')
    const email = assertField(data.email, 'O e-mail do sócio', 'email', { required: true })
    const phone = assertField(data.phone, 'O telefone do sócio', 'phone') || null
    if (await emailAlreadyRegistered(email)) throw new Error('Este e-mail já está cadastrado.')

    const permissions = data.permissions !== undefined ? sanitizePartnerPermissions(data.permissions) : defaultPartnerPermissions()

    const partner = await sequelize.transaction(async (t) => {
      const loginEmail = await resolveLoginEmail(agencyId, email, name)
      const passwordHash = await bcrypt.hash(String(password), 10)
      const user = await User.create(
        { name, email: loginEmail, contactEmail: email, passwordHash, role: 'partner', phone },
        { transaction: t }
      )
      const teamRoleId = await teamRoleService.resolveId(data.teamRoleId, 'agency', agencyId, t)
      return AgencyPartner.create(
        { agencyId, userId: user.id, active: true, teamRoleId, permissions },
        { transaction: t }
      )
    })
    return serialize(partner)
  },

  async update(
    id: string,
    agencyId: string,
    data: { active?: unknown; teamRoleId?: unknown; permissions?: unknown }
  ) {
    const partner = await AgencyPartner.findOne({ where: { id, agencyId } })
    if (!partner) throw new Error('Sócio não encontrado.')
    const patch: Record<string, unknown> = {}
    if (data.active !== undefined) patch.active = data.active === true || data.active === 'true'
    if (data.teamRoleId !== undefined) {
      patch.teamRoleId = await teamRoleService.resolveId(data.teamRoleId, 'agency', agencyId)
    }
    if (data.permissions !== undefined) {
      patch.permissions = sanitizePartnerPermissions(data.permissions)
    }
    await partner.update(patch)
    return serialize(partner)
  },

  async deactivate(id: string, agencyId: string) {
    const partner = await AgencyPartner.findOne({ where: { id, agencyId } })
    if (!partner) throw new Error('Sócio não encontrado.')
    await partner.update({ active: false })
    return serialize(partner)
  },

  async permissionsForUser(userId: string): Promise<AgencyPartnerPermissions | null> {
    const partner = await AgencyPartner.findOne({ where: { userId, active: true } })
    return partner ? sanitizePartnerPermissions(partner.permissions) : null
  },
}
