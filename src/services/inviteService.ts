import crypto from 'crypto'
import { Invite } from '../models/Invite'
import { Agency } from '../models/Agency'

export const inviteService = {
  async create(agencyId: string, role: string) {
    if (!['supermarket', 'freelancer', 'leader'].includes(role)) {
      throw new Error('Papel de convite inválido.')
    }
    if (role === 'leader') {
      throw new Error('Convite de líder ainda não está disponível.')
    }
    const token = crypto.randomBytes(24).toString('hex')
    return Invite.create({ agencyId, role: role as Invite['role'], token })
  },

  /** Convite ainda válido (pendente e não expirado) — usado tanto na prévia pública quanto no resgate. */
  async findActiveByToken(token: string) {
    const invite = await Invite.findOne({ where: { token }, include: [{ model: Agency, as: 'inviteAgency' }] })
    if (!invite) throw new Error('Convite não encontrado.')
    if (invite.status !== 'pending') throw new Error('Este convite já foi usado ou revogado.')
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) throw new Error('Este convite expirou.')
    return invite
  },

  async markUsed(invite: import('../models/Invite').InviteInstance, transaction?: import('sequelize').Transaction) {
    return invite.update({ status: 'used', usedAt: new Date() }, { transaction })
  },
}
