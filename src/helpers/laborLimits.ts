// src/helpers/laborLimits.ts
//
// Tetos de jornada (para não infringir a legislação trabalhista) e intervalo padrão.
// A agência define os padrões (`/agency/settings`); cada vaga pode sobrescrever.

export const DEFAULT_MAX_SHIFT_HOURS = 10
export const DEFAULT_MAX_JOB_HOURS = 10
export const DEFAULT_BREAK_MINUTES = 0

export interface LaborLimits {
  /** Intervalo padrão (min) descontado de um turno quando a vaga usa "intervalo padrão". */
  defaultBreakMinutes: number
  /** Máximo de minutos de um único turno (líquido de intervalo). */
  maxShiftMinutes: number
  /** Máximo de minutos somados de todos os turnos de uma vaga (líquido de intervalo). */
  maxJobMinutes: number
}

type WithLimits = {
  defaultBreakMinutes?: number | null
  maxShiftHours?: number | string | null
  maxJobHours?: number | string | null
}

const num = (v: unknown, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/** Resolve os limites efetivos com a cascata vaga → agência → padrão. */
export function resolveLaborLimits(job: WithLimits | null, agency: WithLimits | null): LaborLimits {
  const defaultBreakMinutes =
    job?.defaultBreakMinutes ?? agency?.defaultBreakMinutes ?? DEFAULT_BREAK_MINUTES
  const maxShiftHours = num(
    job?.maxShiftHours ?? agency?.maxShiftHours,
    DEFAULT_MAX_SHIFT_HOURS
  )
  const maxJobHours = num(job?.maxJobHours ?? agency?.maxJobHours, DEFAULT_MAX_JOB_HOURS)
  return {
    defaultBreakMinutes: Math.max(0, Math.trunc(Number(defaultBreakMinutes) || 0)),
    maxShiftMinutes: Math.round(maxShiftHours * 60),
    maxJobMinutes: Math.round(maxJobHours * 60),
  }
}

/** "6h 15min" a partir de minutos — para as mensagens de erro. */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m}min`
  return m ? `${h}h ${m}min` : `${h}h`
}
