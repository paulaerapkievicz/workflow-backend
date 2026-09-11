// src/helpers/agencyPartnerPermissions.ts

/**
 * Catálogo fixo de áreas funcionais que um sócio (AgencyPartner) pode ou não acessar.
 * O dono da agência liga/desliga cada uma por sócio — default = tudo ligado ("acesso total"),
 * ele restringe o que quiser depois. Diferente do líder (permissões fixas no código, mais
 * escopo por colaborador/filial), o sócio tem acesso amplo por padrão, configurável por
 * funcionalidade, sem escopo de colaborador/filial.
 */
export const AGENCY_PARTNER_FEATURES = [
  'vagas',
  'clientes',
  'colaboradores',
  'financeiro',
  'equipe',
  'configuracoes',
] as const

export type AgencyPartnerFeature = (typeof AGENCY_PARTNER_FEATURES)[number]

export const AGENCY_PARTNER_FEATURE_LABELS: Record<AgencyPartnerFeature, string> = {
  vagas: 'Vagas e Convocações',
  clientes: 'Gestão de Clientes',
  colaboradores: 'Colaboradores',
  financeiro: 'Financeiro (fechamentos, faturas, pagamentos)',
  equipe: 'Equipe (líderes)',
  configuracoes: 'Configurações',
}

export type AgencyPartnerPermissions = Record<AgencyPartnerFeature, boolean>

export function defaultPartnerPermissions(): AgencyPartnerPermissions {
  return AGENCY_PARTNER_FEATURES.reduce((acc, key) => {
    acc[key] = true
    return acc
  }, {} as AgencyPartnerPermissions)
}

/** Normaliza um valor qualquer (JSON vindo do banco ou do body) pro shape completo, sem chave faltando. */
export function sanitizePartnerPermissions(raw: unknown): AgencyPartnerPermissions {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return AGENCY_PARTNER_FEATURES.reduce((acc, key) => {
    acc[key] = input[key] !== false
    return acc
  }, {} as AgencyPartnerPermissions)
}
