import { Supermarket } from '../models/Supermarket'
import { Agency } from '../models/Agency'
import { Freelancer } from '../models/Freelancer'
import { SupermarketMember } from '../models/SupermarketMember'
import { UserInstance } from '../models/User'

export interface SupermarketContext {
  supermarketId: string
  /** NULL = rede toda; preenchido = gerente restrito a uma loja. */
  branchId: string | null
  canSubmitOrders: boolean
  canApproveOrders: boolean
  isOwner: boolean
}

/**
 * Resolve o perfil de negócio ligado a um usuário conforme o papel:
 * - supermarket -> Supermarket (owner_id OU membro da equipe)
 * - agency      -> Agency (owner_id)
 * - freelancer  -> Freelancer (user_id)
 * - admin       -> null
 */
export const profileService = {
  async forUser(user: Pick<UserInstance, 'id' | 'role'>) {
    switch (user.role) {
      case 'supermarket': {
        const owned = await Supermarket.findOne({ where: { ownerId: user.id } })
        if (owned) return owned
        const member = await SupermarketMember.findOne({ where: { userId: user.id } })
        return member ? Supermarket.findByPk(member.supermarketId) : null
      }
      case 'agency':
        return Agency.findOne({ where: { ownerId: user.id } })
      case 'freelancer':
        // inclui a agência para o app do freelancer conhecer prazo de cancelamento, etc.
        return Freelancer.findOne({
          where: { userId: user.id },
          include: [{ model: Agency, as: 'affiliatedAgency' }],
        })
      default:
        return null
    }
  },

  async supermarketIdForUser(user: Pick<UserInstance, 'id' | 'role'>) {
    const s = await Supermarket.findOne({ where: { ownerId: user.id } })
    if (s) return s.id
    const member = await SupermarketMember.findOne({ where: { userId: user.id } })
    return member?.supermarketId ?? null
  },

  /** Contexto de permissões do usuário no supermercado (dono ou gerente de loja). */
  async supermarketContextForUser(
    user: Pick<UserInstance, 'id' | 'role'>
  ): Promise<SupermarketContext | null> {
    const owned = await Supermarket.findOne({ where: { ownerId: user.id } })
    if (owned) {
      const m = await SupermarketMember.findOne({ where: { supermarketId: owned.id, userId: user.id } })
      return {
        supermarketId: owned.id,
        branchId: m?.branchId ?? null,
        canSubmitOrders: m?.canSubmitOrders ?? true,
        canApproveOrders: m?.canApproveOrders ?? true,
        isOwner: true,
      }
    }
    const member = await SupermarketMember.findOne({ where: { userId: user.id } })
    if (!member) return null
    return {
      supermarketId: member.supermarketId,
      branchId: member.branchId ?? null,
      canSubmitOrders: member.canSubmitOrders,
      canApproveOrders: member.canApproveOrders,
      isOwner: member.isOwner,
    }
  },

  async agencyIdForUser(user: Pick<UserInstance, 'id' | 'role'>) {
    const a = await Agency.findOne({ where: { ownerId: user.id } })
    return a?.id ?? null
  },

  async freelancerForUser(user: Pick<UserInstance, 'id' | 'role'>) {
    return Freelancer.findOne({ where: { userId: user.id } })
  },
}
