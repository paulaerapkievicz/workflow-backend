import { Supermarket } from '../models/Supermarket'
import { Agency } from '../models/Agency'
import { Freelancer } from '../models/Freelancer'
import { SupermarketMember } from '../models/SupermarketMember'
import { SupermarketMemberBranch } from '../models/SupermarketMemberBranch'
import { AgencyMember } from '../models/AgencyMember'
import { AgencyMemberFreelancer } from '../models/AgencyMemberFreelancer'
import { AgencyMemberBranch } from '../models/AgencyMemberBranch'
import { UserInstance } from '../models/User'
import { AgencyActor } from '../helpers/agencyScope'

export interface SupermarketContext {
  supermarketId: string
  /** NULL = rede toda; array (nunca vazio) = gerente restrito a essas filiais. */
  branchIds: string[] | null
  canSubmitOrders: boolean
  canApproveOrders: boolean
  /** Vê as faturas (fechamento mensal) da rede. */
  canViewInvoices: boolean
  /** Além de ver, paga a fatura e lança/remove contestação. */
  canPayInvoices: boolean
  isOwner: boolean
}

async function branchIdsForMember(memberId: string): Promise<string[] | null> {
  const links = await SupermarketMemberBranch.findAll({
    where: { supermarketMemberId: memberId },
    attributes: ['branchId'],
  })
  return links.length ? links.map((l) => l.branchId) : null
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
        // inclui a agência-cliente para a UI saber, p.ex., se a avaliação de colaborador está ligada
        const withAgency = {
          include: [
            {
              model: Agency,
              as: 'clientAgency',
              attributes: [
                'id', 'name', 'reviewEnabled', 'statusColors',
                'defaultBreakMinutes', 'maxShiftHours', 'maxJobHours',
                'appPaymentEnabledForSupermarkets',
              ],
            },
          ],
        }
        const owned = await Supermarket.findOne({ where: { ownerId: user.id }, ...withAgency })
        if (owned) return owned
        const member = await SupermarketMember.findOne({ where: { userId: user.id } })
        return member ? Supermarket.findByPk(member.supermarketId, withAgency) : null
      }
      case 'agency':
        return Agency.findOne({ where: { ownerId: user.id } })
      case 'freelancer':
        // inclui a agência para o app do freelancer conhecer prazo de cancelamento, etc.
        return Freelancer.findOne({
          where: { userId: user.id },
          include: [{ model: Agency, as: 'affiliatedAgency' }],
        })
      case 'leader':
        return AgencyMember.findOne({
          where: { userId: user.id },
          include: [{ model: Agency, as: 'memberAgency' }],
        })
      default:
        return null
    }
  },

  /**
   * Contexto de atuação pela agência (dono ou líder). Devolve `null` quando o usuário não
   * está ligado a nenhuma agência (ou o líder foi desativado).
   */
  async agencyContextForUser(user: Pick<UserInstance, 'id' | 'role'>): Promise<AgencyActor | null> {
    if (user.role === 'agency') {
      const a = await Agency.findOne({ where: { ownerId: user.id } })
      return a
        ? { agencyId: a.id, isOwner: true, memberId: null, scopeFreelancerIds: null, scopeBranchIds: null }
        : null
    }
    if (user.role === 'leader') {
      const m = await AgencyMember.findOne({ where: { userId: user.id, active: true } })
      if (!m) return null
      const [fr, br] = await Promise.all([
        AgencyMemberFreelancer.findAll({ where: { agencyMemberId: m.id }, attributes: ['freelancerId'] }),
        AgencyMemberBranch.findAll({ where: { agencyMemberId: m.id }, attributes: ['branchId'] }),
      ])
      const freelancerIds = fr.map((x) => x.freelancerId)
      const branchIds = br.map((x) => x.branchId)
      return {
        agencyId: m.agencyId,
        isOwner: false,
        memberId: m.id,
        scopeFreelancerIds: freelancerIds.length ? freelancerIds : null,
        scopeBranchIds: branchIds.length ? branchIds : null,
      }
    }
    return null
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
      // O dono enxerga a rede toda e sempre pode ver/pagar as faturas.
      return {
        supermarketId: owned.id,
        branchIds: null,
        canSubmitOrders: true,
        canApproveOrders: true,
        canViewInvoices: true,
        canPayInvoices: true,
        isOwner: true,
      }
    }
    const member = await SupermarketMember.findOne({ where: { userId: user.id } })
    if (!member) return null
    return {
      supermarketId: member.supermarketId,
      branchIds: member.isOwner ? null : await branchIdsForMember(member.id),
      canSubmitOrders: member.canSubmitOrders,
      canApproveOrders: member.canApproveOrders,
      canViewInvoices: member.canViewInvoices,
      canPayInvoices: member.canPayInvoices,
      isOwner: member.isOwner,
    }
  },

  async agencyIdForUser(user: Pick<UserInstance, 'id' | 'role'>) {
    const a = await Agency.findOne({ where: { ownerId: user.id } })
    if (a) return a.id
    // Líder resolve para a agência dele — rotas financeiras seguem barradas no authorize('agency').
    if (user.role === 'leader') {
      const m = await AgencyMember.findOne({ where: { userId: user.id, active: true } })
      return m?.agencyId ?? null
    }
    return null
  },

  async freelancerForUser(user: Pick<UserInstance, 'id' | 'role'>) {
    return Freelancer.findOne({ where: { userId: user.id } })
  },
}
