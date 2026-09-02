// src/helpers/shifts.ts

export const SHIFT_PERIODS = ['manha', 'tarde', 'noite', 'madrugada'] as const
export type ShiftPeriod = (typeof SHIFT_PERIODS)[number]

/** Janela fixa de cada turno (o supermercado pode estreitar dentro dela). */
export const SHIFT_BOUNDS: Record<ShiftPeriod, { label: string; start: string; end: string }> = {
  manha: { label: 'Manhã', start: '06:00', end: '12:00' },
  tarde: { label: 'Tarde', start: '12:00', end: '18:00' },
  noite: { label: 'Noite', start: '18:00', end: '24:00' },
  madrugada: { label: 'Madrugada', start: '00:00', end: '06:00' },
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function isShiftPeriod(v: any): v is ShiftPeriod {
  return SHIFT_PERIODS.includes(v)
}

/**
 * Resolve início/fim reais de uma vaga a partir do turno + data (YYYY-MM-DD),
 * opcionalmente estreitando com horas HH:MM dentro da janela do turno.
 */
export function resolveShift(
  period: ShiftPeriod,
  date: string,
  startHHMM?: string | null,
  endHHMM?: string | null
): { startTime: Date; endTime: Date; label: string } {
  const bounds = SHIFT_BOUNDS[period]
  if (!bounds) throw new Error('Turno inválido. Use manha, tarde, noite ou madrugada.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Data da vaga inválida (use AAAA-MM-DD).')

  const bStart = toMin(bounds.start)
  const bEnd = bounds.end === '24:00' ? 1440 : toMin(bounds.end)

  const s = startHHMM && /^\d{2}:\d{2}$/.test(startHHMM) ? toMin(startHHMM) : bStart
  let e = endHHMM && /^\d{2}:\d{2}$/.test(endHHMM) ? toMin(endHHMM) : bEnd
  // "00:00" no turno da noite significa meia-noite (fim da janela)
  if (period === 'noite' && e === 0) e = 1440

  if (s < bStart || e > bEnd || s >= e) {
    throw new Error(`Horário fora do turno ${bounds.label} (${bounds.start}–${bounds.end}).`)
  }

  const base = new Date(`${date}T00:00:00`)
  return {
    startTime: new Date(base.getTime() + s * 60000),
    endTime: new Date(base.getTime() + e * 60000),
    label: bounds.label,
  }
}

export interface RawShift {
  shiftPeriod?: unknown
  startTime?: string | null
  endTime?: string | null
}

export interface ResolvedShift {
  shiftPeriod: ShiftPeriod
  startTime: Date
  endTime: Date
  label: string
}

/**
 * Resolve um ou mais turnos de uma mesma vaga (data YYYY-MM-DD).
 * Cada turno pode estreitar sua janela com horas HH:MM; turnos repetidos são rejeitados.
 * Retorna a lista ordenada pelo horário de início.
 */
export function resolveShifts(rawShifts: RawShift[], date: string): ResolvedShift[] {
  if (!Array.isArray(rawShifts) || !rawShifts.length) {
    throw new Error('Selecione ao menos um turno (manhã, tarde, noite ou madrugada).')
  }

  const seen = new Set<ShiftPeriod>()
  const resolved = rawShifts.map((raw) => {
    if (!isShiftPeriod(raw?.shiftPeriod)) {
      throw new Error('Selecione o turno (manhã, tarde, noite ou madrugada).')
    }
    if (seen.has(raw.shiftPeriod)) {
      throw new Error(`Turno ${SHIFT_BOUNDS[raw.shiftPeriod].label} informado mais de uma vez.`)
    }
    seen.add(raw.shiftPeriod)
    return { shiftPeriod: raw.shiftPeriod, ...resolveShift(raw.shiftPeriod, date, raw.startTime, raw.endTime) }
  })

  return resolved.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
}
