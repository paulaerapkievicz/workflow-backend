// src/helpers/alerts.ts
//
// Catálogo e parâmetros do controle de ocorrências das vagas (atraso no check-in, falta,
// saída antecipada, turno sem check-out, vaga descoberta, pausa estourada, etc.).
//
// O motor de detecção (`jobAlertService`) tem duas frentes:
//  - hooks nos serviços que já existem (consequência de uma ação: check-in atrasado, saída
//    antecipada, desistência de última hora…);
//  - uma varredura periódica (`sweep`) para o que é *ausência* de ação (ninguém bateu ponto,
//    ninguém aceitou a vaga, pausa não retomada).

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number]

export const ALERT_STATUSES = ['open', 'acknowledged', 'resolved'] as const
export type AlertStatus = (typeof ALERT_STATUSES)[number]

export const ALERT_AUDIENCES = ['agency', 'leader', 'supermarket'] as const
export type AlertAudience = (typeof ALERT_AUDIENCES)[number]

/** Como o alerta foi encerrado: automático, após uma ação da agência, ou descartado. */
export const ALERT_RESOLUTION_CODES = ['auto', 'acted', 'dismissed'] as const
export type AlertResolutionCode = (typeof ALERT_RESOLUTION_CODES)[number]

export const JOB_ALERT_TYPES = [
  'shift_unfilled_soon',
  'shift_unfilled_started',
  'late_checkin',
  'no_show',
  'early_checkout',
  'missing_checkout',
  'break_overrun',
  'break_not_resumed',
  'shift_missed',
  'late_withdrawal',
  'partial_completion',
  'overtime_hold',
  'no_show_confirmed',
] as const
export type JobAlertType = (typeof JOB_ALERT_TYPES)[number]

/** Severidade → peso, para comparar se uma ocorrência escalou. */
export const SEVERITY_RANK: Record<AlertSeverity, number> = { info: 0, warning: 1, critical: 2 }

/**
 * Tipos "donos" da varredura periódica — nascem e morrem pela ausência/retorno de um evento,
 * então a varredura pode resolvê-los sozinha quando a condição deixa de valer. Os demais
 * (saída antecipada, desistência, cumprimento parcial, hora extra) são disparados por um
 * evento pontual e só a agência ou outro hook os encerra.
 */
export const SWEEPER_OWNED_TYPES: JobAlertType[] = [
  'shift_unfilled_soon',
  'shift_unfilled_started',
  'late_checkin',
  'no_show',
  'missing_checkout',
  'break_overrun',
  'break_not_resumed',
  'shift_missed',
]

export interface AlertCatalogEntry {
  /** Rótulo curto em pt-BR (badge). */
  label: string
  baseSeverity: AlertSeverity
  /** Quem enxerga por padrão (o supermercado ainda depende de `notifySupermarketOnAlerts`). */
  audience: AlertAudience[]
  /** Orientação de tratamento mostrada na tela de alertas. */
  resolutionHint: string
  /**
   * Override do `resolutionHint` por papel — usado quando o texto padrão instrui uma ação que só
   * a agência/líder pode tomar (ex.: "force o checkout pela agência"), o que soa incoerente pro
   * supermercado, que só acompanha. Sem entrada para o papel, cai no `resolutionHint` padrão.
   */
  resolutionHintByRole?: Partial<Record<AlertAudience, string>>
}

export const ALERT_CATALOG: Record<JobAlertType, AlertCatalogEntry> = {
  shift_unfilled_soon: {
    label: 'Vaga sem colaborador',
    baseSeverity: 'warning',
    audience: ['agency', 'leader'],
    resolutionHint: 'Trabalhe o pool ou atribua um colaborador. O alerta fecha sozinho quando alguém aceita.',
  },
  shift_unfilled_started: {
    label: 'Vaga descoberta (turno começou)',
    baseSeverity: 'critical',
    audience: ['agency', 'leader', 'supermarket'],
    resolutionHint: 'Atribua um colaborador com urgência ou cancele o item do pedido. Fecha ao ser aceita.',
  },
  late_checkin: {
    label: 'Atraso no check-in',
    baseSeverity: 'warning',
    audience: ['agency', 'leader', 'supermarket'],
    resolutionHint: 'Fecha sozinho quando o colaborador bate o ponto. Se não vier, registre a falta ou troque o colaborador.',
    resolutionHintByRole: {
      supermarket: 'Fecha sozinho quando o colaborador bate o ponto. Se não vier, a agência foi avisada para registrar a falta ou trocar o colaborador.',
    },
  },
  no_show: {
    label: 'Falta (sem check-in)',
    baseSeverity: 'critical',
    audience: ['agency', 'leader', 'supermarket'],
    resolutionHint: 'Registre a falta (bloqueia o colaborador por 7 dias) ou troque o colaborador da vaga.',
    resolutionHintByRole: {
      supermarket: 'A agência foi avisada para registrar a falta (bloqueia o colaborador por 7 dias) ou trocar o colaborador da vaga.',
    },
  },
  early_checkout: {
    label: 'Saída antecipada',
    baseSeverity: 'warning',
    audience: ['agency', 'leader', 'supermarket'],
    resolutionHint: 'Revise o ponto: corrija o horário se foi engano, ou aceite (a liquidação já é proporcional às horas).',
  },
  missing_checkout: {
    label: 'Turno sem check-out',
    baseSeverity: 'warning',
    audience: ['agency', 'leader', 'supermarket'],
    resolutionHint: 'Force o checkout pela agência (fecha o turno com as horas feitas) ou corrija o ponto.',
    resolutionHintByRole: {
      supermarket: 'O colaborador não bateu o check-out. A agência foi avisada para corrigir o ponto ou encerrar o turno.',
    },
  },
  break_overrun: {
    label: 'Pausa acima do limite',
    baseSeverity: 'warning',
    audience: ['agency', 'leader'],
    resolutionHint: 'Encerre a pausa pela agência. O tempo de pausa não conta como hora trabalhada.',
  },
  break_not_resumed: {
    label: 'Pausa não retomada',
    baseSeverity: 'critical',
    audience: ['agency', 'leader'],
    resolutionHint: 'Encerre a pausa e force o checkout pela agência.',
  },
  shift_missed: {
    label: 'Turno perdido',
    baseSeverity: 'warning',
    audience: ['agency', 'leader', 'supermarket'],
    resolutionHint: 'Decida entre aceitar a entrega parcial ou reabrir o restante para outro colaborador.',
    resolutionHintByRole: {
      supermarket: 'A agência foi avisada para decidir entre aceitar a entrega parcial ou reabrir o restante para outro colaborador.',
    },
  },
  late_withdrawal: {
    label: 'Desistência de última hora',
    baseSeverity: 'warning',
    audience: ['agency', 'leader'],
    resolutionHint: 'A vaga voltou ao pool — priorize o preenchimento. Fecha ao ser reaceita.',
  },
  partial_completion: {
    label: 'Cumprimento parcial',
    baseSeverity: 'warning',
    audience: ['agency', 'leader', 'supermarket'],
    resolutionHint: 'A liquidação já é proporcional. Corrija o ponto se houve erro de marcação, ou resolva com uma nota.',
  },
  overtime_hold: {
    label: 'Hora extra retida',
    baseSeverity: 'info',
    audience: ['agency', 'leader'],
    resolutionHint: 'Libere (ou limite ao contratado) o pagamento em "Pagamentos → aguardando liberação".',
  },
  no_show_confirmed: {
    label: 'Falta confirmada',
    baseSeverity: 'info',
    audience: ['agency', 'leader', 'supermarket'],
    resolutionHint: 'Registro de auditoria — a falta já foi tratada pela agência.',
  },
}

// ————————————————————————————————————————————————————————————————
// Parâmetros fixos (não configuráveis pela agência)
// ————————————————————————————————————————————————————————————————

/** Intervalo da varredura periódica de ocorrências. */
export const SWEEP_INTERVAL_MS = 120_000
/** Primeira varredura logo após o boot. */
export const SWEEP_FIRST_DELAY_MS = 15_000
/** Pausa aberta há mais que isto (min) abre `break_overrun`. */
export const BREAK_OPEN_ALERT_MINUTES = 45
/** `missing_checkout` vira crítico depois deste atraso (min) sobre o fim do turno. */
export const MISSING_CHECKOUT_CRITICAL_MINUTES = 60
/** `shift_unfilled_soon` vira crítico quando falta menos que isto (min) para o turno. */
export const UNFILLED_URGENT_MINUTES = 30
/** Abaixo desta fração do contratado, uma vaga concluída gera `partial_completion`. */
export const PARTIAL_COMPLETION_RATIO = 0.8

// ————————————————————————————————————————————————————————————————
// Configuração por agência (colunas em `agencies`, editáveis em /agency/settings)
// ————————————————————————————————————————————————————————————————

export interface AlertSettings {
  alertsEnabled: boolean
  notifySupermarketOnAlerts: boolean
  lateCheckinToleranceMinutes: number
  lateCheckinCriticalMinutes: number
  earlyCheckoutToleranceMinutes: number
  missingCheckoutGraceMinutes: number
  unfilledAlertLeadMinutes: number
  shortNoticeWithdrawalMinutes: number
}

export const ALERT_SETTING_DEFAULTS: AlertSettings = {
  alertsEnabled: true,
  notifySupermarketOnAlerts: true,
  lateCheckinToleranceMinutes: 10,
  lateCheckinCriticalMinutes: 30,
  earlyCheckoutToleranceMinutes: 15,
  missingCheckoutGraceMinutes: 20,
  unfilledAlertLeadMinutes: 120,
  shortNoticeWithdrawalMinutes: 180,
}

/** Faixas aceitas em /agency/settings (min/max inclusivos). */
export const ALERT_SETTING_RANGES: Record<
  Exclude<keyof AlertSettings, 'alertsEnabled' | 'notifySupermarketOnAlerts'>,
  [number, number]
> = {
  lateCheckinToleranceMinutes: [0, 120],
  lateCheckinCriticalMinutes: [5, 240],
  earlyCheckoutToleranceMinutes: [0, 120],
  missingCheckoutGraceMinutes: [0, 240],
  unfilledAlertLeadMinutes: [15, 1440],
  shortNoticeWithdrawalMinutes: [0, 1440],
}

// ————————————————————————————————————————————————————————————————
// Marcações visuais de vaga sem colaborador (bolinhas em Convocações)
// ————————————————————————————————————————————————————————————————

export interface UnfilledAlertTier {
  id: string
  /** Dispara quando faltam <= isto (min) para o início — 0 = na hora ou depois. */
  minutesBefore: number
  /** Cor da bolinha (#RGB ou #RRGGBB). */
  color: string
  /** Rótulo curto (tooltip). */
  label: string
  /** A bolinha pisca enquanto a vaga não é preenchida. */
  blink: boolean
}

export const DEFAULT_UNFILLED_ALERT_TIERS: UnfilledAlertTier[] = [
  { id: 'tier-60', minutesBefore: 60, color: '#EAB308', label: 'Falta 1h', blink: false },
  { id: 'tier-30', minutesBefore: 30, color: '#F97316', label: 'Falta 30 min', blink: true },
  { id: 'tier-0', minutesBefore: 0, color: '#DC2626', label: 'No horário / atrasada', blink: true },
]

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Normaliza a config recebida do front: faixas válidas, ordenadas da mais distante para a mais urgente. */
export function sanitizeUnfilledAlertTiers(raw: unknown): UnfilledAlertTier[] {
  if (!Array.isArray(raw)) return [...DEFAULT_UNFILLED_ALERT_TIERS]
  const tiers: UnfilledAlertTier[] = []
  for (const item of raw.slice(0, 6)) {
    const r = item as Record<string, unknown>
    const minutesBefore = Math.trunc(Number(r?.minutesBefore))
    if (!Number.isFinite(minutesBefore) || minutesBefore < 0 || minutesBefore > 1440) continue
    const color = String(r?.color ?? '').trim()
    if (!HEX_COLOR.test(color)) continue
    const label = String(r?.label ?? '').trim().slice(0, 40) || `${minutesBefore} min`
    const id = String(r?.id ?? '').trim() || `tier-${minutesBefore}-${tiers.length}`
    tiers.push({ id, minutesBefore, color, label, blink: r?.blink === true })
  }
  tiers.sort((a, b) => b.minutesBefore - a.minutesBefore)
  return tiers
}

export function resolveUnfilledAlertTiers(agency: { unfilledAlertTiers?: unknown } | null | undefined): UnfilledAlertTier[] {
  const raw = agency?.unfilledAlertTiers
  if (raw == null) return [...DEFAULT_UNFILLED_ALERT_TIERS]
  return sanitizeUnfilledAlertTiers(raw)
}

type AgencyLike = Partial<AlertSettings> | null | undefined

/** Config efetiva de alertas de uma agência, com fallback nos defaults. */
export function resolveAlertSettings(agency: AgencyLike): AlertSettings {
  const a = agency ?? {}
  const num = (v: unknown, d: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : d
  }
  return {
    alertsEnabled: a.alertsEnabled ?? ALERT_SETTING_DEFAULTS.alertsEnabled,
    notifySupermarketOnAlerts:
      a.notifySupermarketOnAlerts ?? ALERT_SETTING_DEFAULTS.notifySupermarketOnAlerts,
    lateCheckinToleranceMinutes: num(
      a.lateCheckinToleranceMinutes,
      ALERT_SETTING_DEFAULTS.lateCheckinToleranceMinutes
    ),
    lateCheckinCriticalMinutes: num(
      a.lateCheckinCriticalMinutes,
      ALERT_SETTING_DEFAULTS.lateCheckinCriticalMinutes
    ),
    earlyCheckoutToleranceMinutes: num(
      a.earlyCheckoutToleranceMinutes,
      ALERT_SETTING_DEFAULTS.earlyCheckoutToleranceMinutes
    ),
    missingCheckoutGraceMinutes: num(
      a.missingCheckoutGraceMinutes,
      ALERT_SETTING_DEFAULTS.missingCheckoutGraceMinutes
    ),
    unfilledAlertLeadMinutes: num(
      a.unfilledAlertLeadMinutes,
      ALERT_SETTING_DEFAULTS.unfilledAlertLeadMinutes
    ),
    shortNoticeWithdrawalMinutes: num(
      a.shortNoticeWithdrawalMinutes,
      ALERT_SETTING_DEFAULTS.shortNoticeWithdrawalMinutes
    ),
  }
}

/** Público final de um alerta: base do catálogo menos o supermercado quando a agência desliga. */
export function audienceFor(type: JobAlertType, settings: AlertSettings): AlertAudience[] {
  const base = ALERT_CATALOG[type].audience
  if (settings.notifySupermarketOnAlerts) return [...base]
  return base.filter((a) => a !== 'supermarket')
}

/** Chave de deduplicação — uma ocorrência viva por (vaga, turno, tipo). */
export function alertDedupeKey(jobId: string, jobShiftId: string | null | undefined, type: JobAlertType) {
  return `${jobId}:${jobShiftId ?? '_'}:${type}`
}
