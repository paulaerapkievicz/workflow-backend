import crypto from 'crypto'
import { Invite, InviteCreationAttributes } from '../models/Invite'
import { Agency } from '../models/Agency'

interface CreateOptions {
  /**
   * Quem está gerando o convite. O dono ('agency') pode convidar qualquer papel; um líder
   * só convida colaborador; um sócio convida cliente ou colaborador, nunca líder/sócio
   * (evita um sócio se auto-replicar ou criar líderes sem o dono saber).
   */
  callerRole?: 'agency' | 'leader' | 'partner'
  /** Só para role 'leader': pagamento do líder, copiado para o AgencyMember no resgate. */
  payType?: 'hora' | 'diaria' | 'mensal' | 'por_colaborador' | null
  payAmount?: number | null
}

const CALLER_ALLOWED_ROLES: Record<'agency' | 'leader' | 'partner', string[]> = {
  agency: ['supermarket', 'freelancer', 'leader', 'partner'],
  leader: ['freelancer'],
  partner: ['supermarket', 'freelancer'],
}

export const inviteService = {
  async create(agencyId: string, role: string, options: CreateOptions = {}) {
    if (!['supermarket', 'freelancer', 'leader', 'partner'].includes(role)) {
      throw new Error('Papel de convite inválido.')
    }
    const callerRole = options.callerRole ?? 'agency'
    if (!CALLER_ALLOWED_ROLES[callerRole].includes(role)) {
      throw new Error(
        callerRole === 'leader'
          ? 'Um líder só pode convidar colaboradores.'
          : 'Um sócio só pode convidar clientes ou colaboradores.'
      )
    }

    const attrs: InviteCreationAttributes = {
      agencyId,
      role: role as Invite['role'],
      token: crypto.randomBytes(24).toString('hex'),
    }

    if (role === 'leader') {
      const type = options.payType
      const amount = options.payAmount != null ? Number(options.payAmount) : null
      if (!type || !['hora', 'diaria', 'mensal', 'por_colaborador'].includes(type)) {
        throw new Error(
          'Escolha a forma de pagamento do líder (hora, diária, mensal ou por colaborador que trabalhou).'
        )
      }
      if (amount == null || !Number.isFinite(amount) || amount <= 0) {
        throw new Error('Informe o valor de pagamento do líder (maior que zero).')
      }
      attrs.payType = type
      attrs.payAmount = amount
    }

    return Invite.create(attrs)
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
