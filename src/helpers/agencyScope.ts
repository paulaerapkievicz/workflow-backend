/**
 * Escopo de atuação de quem opera pela agência.
 *
 * - Dono da agência (`role: 'agency'`): `isOwner = true`, sem restrição.
 * - Líder (`role: 'leader'`, ver `AgencyMember`): pode ser restrito a um subconjunto de
 *   colaboradores e/ou de filiais. `scope*Ids = null` significa "irrestrito nessa dimensão".
 *
 * Nada financeiro/contábil chega aqui — as rotas de faturamento/fechamento/pagamento/saldo
 * continuam barradas no `authorize('agency')` (dono-only), então o escopo só refina o que
 * um líder enxerga/gerencia em vagas e colaboradores.
 */
export interface AgencyActor {
  agencyId: string
  isOwner: boolean
  /** id do `AgencyMember` quando for um líder; null para o dono. */
  memberId: string | null
  scopeFreelancerIds: string[] | null
  scopeBranchIds: string[] | null
}

export function inFreelancerScope(actor: AgencyActor, freelancerId?: string | null): boolean {
  if (actor.isOwner || !actor.scopeFreelancerIds) return true
  return !!freelancerId && actor.scopeFreelancerIds.includes(freelancerId)
}

export function inBranchScope(actor: AgencyActor, branchId?: string | null): boolean {
  if (actor.isOwner || !actor.scopeBranchIds) return true
  return !!branchId && actor.scopeBranchIds.includes(branchId)
}

export function assertBranchInScope(actor: AgencyActor, branchId?: string | null): void {
  if (!inBranchScope(actor, branchId)) {
    throw new Error('Esta vaga está fora do seu grupo de trabalho.')
  }
}

export function assertFreelancerInScope(actor: AgencyActor, freelancerId?: string | null): void {
  if (!inFreelancerScope(actor, freelancerId)) {
    throw new Error('Este colaborador está fora do seu grupo de trabalho.')
  }
}
