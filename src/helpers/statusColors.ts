// src/helpers/statusColors.ts
//
// Cores das "tags" (badges) de status que a agência pode personalizar. Em vez de uma
// cor por status de cada família (vaga, pedido, fatura, pagamento…), o sistema tem
// 6 TONS semânticos — todo badge de status do produto cai em um deles. Personalizar
// os 6 tons recolore, de forma coerente, os badges de todas as famílias.

export type StatusTone =
  | 'pending' // aguardando / disponível (âmbar)
  | 'progress' // em andamento / aceito (azul)
  | 'waiting' // aguardando aprovação (âmbar forte)
  | 'approved' // aprovado / ativo (violeta)
  | 'done' // concluído / pago (verde)
  | 'canceled' // cancelado / recusado (vermelho)

export interface ToneColor {
  /** Cor de fundo do badge (#RGB ou #RRGGBB). */
  bg: string
  /** Cor do texto do badge. */
  fg: string
}

export type StatusColors = Record<StatusTone, ToneColor>

export const STATUS_TONES: StatusTone[] = [
  'pending',
  'progress',
  'waiting',
  'approved',
  'done',
  'canceled',
]

/** Paleta padrão — espelha styles/panel.module.scss (tema claro). */
export const DEFAULT_STATUS_COLORS: StatusColors = {
  pending: { bg: '#fef3c7', fg: '#92400e' },
  progress: { bg: '#dbeafe', fg: '#1e40af' },
  waiting: { bg: '#fde68a', fg: '#92400e' },
  approved: { bg: '#ede9fe', fg: '#5b21b6' },
  done: { bg: '#dcfce7', fg: '#166534' },
  canceled: { bg: '#fee2e2', fg: '#991b1b' },
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

const cleanHex = (v: unknown, fallback: string): string =>
  typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toLowerCase() : fallback

/**
 * Normaliza o que veio do cliente: só tons conhecidos, só hex válido, completa o que
 * faltar com o padrão. Nunca lança — sempre devolve uma paleta completa.
 */
export function sanitizeStatusColors(raw: unknown): StatusColors {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const out = {} as StatusColors
  for (const tone of STATUS_TONES) {
    const def = DEFAULT_STATUS_COLORS[tone]
    const got = input[tone] && typeof input[tone] === 'object' ? input[tone] : {}
    out[tone] = { bg: cleanHex(got.bg, def.bg), fg: cleanHex(got.fg, def.fg) }
  }
  return out
}

/** Paleta efetiva de uma agência (com fallback total para o padrão). */
export function resolveStatusColors(agency: { statusColors?: unknown } | null): StatusColors {
  return sanitizeStatusColors(agency?.statusColors)
}
