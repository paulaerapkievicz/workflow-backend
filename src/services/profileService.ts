import { Supermarket } from '../models/Supermarket'
import { Agency } from '../models/Agency'
import { Freelancer } from '../models/Freelancer'
import { UserInstance } from '../models/User'

/**
 * Resolve o perfil de negócio ligado a um usuário conforme o papel:
 * - supermarket -> Supermarket (owner_id)
 * - agency      -> Agency (owner_id)
 * - freelancer  -> Freelancer (user_id)
 * - admin       -> null
 */
export const profileService = {
  async forUser(user: Pick<UserInstance, 'id' | 'role'>) {
    switch (user.role) {
      case 'supermarket':
        return Supermarket.findOne({ where: { ownerId: user.id } })
      case 'agency':
        return Agency.findOne({ where: { ownerId: user.id } })
      case 'freelancer':
        return Freelancer.findOne({ where: { userId: user.id } })
      default:
        return null
    }
  },

  async supermarketIdForUser(user: Pick<UserInstance, 'id' | 'role'>) {
    const s = await Supermarket.findOne({ where: { ownerId: user.id } })
    return s?.id ?? null
  },

  async agencyIdForUser(user: Pick<UserInstance, 'id' | 'role'>) {
    const a = await Agency.findOne({ where: { ownerId: user.id } })
    return a?.id ?? null
  },

  async freelancerForUser(user: Pick<UserInstance, 'id' | 'role'>) {
    return Freelancer.findOne({ where: { userId: user.id } })
  },
}
