// src/helpers/agencyMemberPermissions.ts

/**
 * Catálogo de permissões configuráveis de um líder (AgencyMember) — diferente do sócio
 * (acesso amplo por área, ver `agencyPartnerPermissions.ts`), o líder já tem um conjunto de
 * poderes fixo e menor por design (vagas/colaboradores, sem financeiro). O que sobra como
 * configurável por líder é a ação de ALTERAR dado sensível de outra parte — mexer no horário
 * já combinado da vaga, ou no valor/hora que o colaborador recebe. Ver/atuar em vagas
 * (pool, alocações, ao vivo, alertas, liberar/falta/forçar checkout/remanejar) continua
 * sempre liberado pra todo líder, sem toggle — é a razão de existir do papel.
 */
export const AGENCY_MEMBER_FEATURES = ['horarios', 'valores'] as const

export type AgencyMemberFeature = (typeof AGENCY_MEMBER_FEATURES)[number]

export const AGENCY_MEMBER_FEATURE_LABELS: Record<AgencyMemberFeature, string> = {
  horarios: 'Editar horário da vaga e corrigir ponto (check-in/checkout, pausas)',
  valores: 'Definir valor/hora do colaborador por função',
}

export type AgencyMemberPermissions = Record<AgencyMemberFeature, boolean>

export function defaultAgencyMemberPermissions(): AgencyMemberPermissions {
  return AGENCY_MEMBER_FEATURES.reduce((acc, key) => {
    acc[key] = true
    return acc
  }, {} as AgencyMemberPermissions)
}

/** Normaliza um valor qualquer (JSON vindo do banco ou do body) pro shape completo, sem chave faltando. */
export function sanitizeAgencyMemberPermissions(raw: unknown): AgencyMemberPermissions {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return AGENCY_MEMBER_FEATURES.reduce((acc, key) => {
    acc[key] = input[key] !== false
    return acc
  }, {} as AgencyMemberPermissions)
}
