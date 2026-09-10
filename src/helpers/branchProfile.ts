// src/helpers/branchProfile.ts

import { BranchInstance } from '../models/Branch'
import { SupermarketInstance } from '../models/Supermarket'

/**
 * Perfil efetivo da filial: cada campo em branco na filial herda o valor da matriz
 * (supermercado). `name`/`address`/`phone`/coordenadas são sempre próprios da filial.
 */
export interface ResolvedBranchProfile {
  name: string
  address: string
  phone: string | null
  legalName: string | null
  cnpj: string | null
  email: string | null
  logoUrl: string | null
  profilePhotoUrl: string | null
  /** Quais campos vieram da matriz (para a UI mostrar "herdado"). */
  inherited: string[]
}

function pick(
  branchValue: string | null | undefined,
  marketValue: string | null | undefined,
  field: string,
  inherited: string[]
): string | null {
  const own = (branchValue ?? '').trim()
  if (own) return own
  const parent = (marketValue ?? '').trim()
  if (parent) {
    inherited.push(field)
    return parent
  }
  return null
}

export function resolveBranchProfile(
  branch: BranchInstance,
  supermarket: SupermarketInstance | null
): ResolvedBranchProfile {
  const inherited: string[] = []
  return {
    name: branch.name,
    address: branch.address,
    phone: (branch.phone ?? '').trim() || null,
    legalName: pick(branch.legalName, supermarket?.legalName, 'legalName', inherited),
    cnpj: pick(branch.cnpj, supermarket?.cnpj, 'cnpj', inherited),
    email: pick(branch.email, supermarket?.email, 'email', inherited),
    logoUrl: pick(branch.logoUrl, supermarket?.logoUrl, 'logoUrl', inherited),
    profilePhotoUrl: pick(
      branch.profilePhotoUrl,
      supermarket?.profilePhotoUrl,
      'profilePhotoUrl',
      inherited
    ),
    inherited,
  }
}
