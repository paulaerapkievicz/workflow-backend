// src/helpers/shifts.ts

export const SHIFT_PERIODS = ['manha', 'tarde', 'noite', 'madrugada'] as const
export type ShiftPeriod = (typeof SHIFT_PERIODS)[number]

/**
 * Janela "sugerida" de cada período nominal. É só um atalho de preenchimento / rótulo —
 * o horário real do turno é livre e pode até atravessar a meia-noite.
 */
export const SHIFT_BOUNDS: Record<ShiftPeriod, { label: string; start: string; end: string }> = {
  manha: { label: 'Manhã', start: '06:00', end: '12:00' },
  tarde: { label: 'Tarde', start: '12:00', end: '18:00' },
  noite: { label: 'Noite', start: '18:00', end: '24:00' },
  madrugada: { label: 'Madrugada', start: '00:00', end: '06:00' },
}

const MAX_SHIFT_MINUTES = 24 * 60

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function isShiftPeriod(v: any): v is ShiftPeriod {
  return SHIFT_PERIODS.includes(v)
}

const isHHMM = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v)

/** Período nominal a partir dos minutos do dia (fuso de Brasília) — só rótulo. */
export function nominalPeriodFromMinutes(min: number): ShiftPeriod {
  const h = Math.floor((min % 1440) / 60)
  if (h < 6) return 'madrugada'
  if (h < 12) return 'manha'
  if (h < 18) return 'tarde'
  return 'noite'
}

export interface RawShift {
  /** Período nominal opcional (rótulo/filtro). Aceita também a chave legada `shiftPeriod`. */
  nominalPeriod?: unknown
  shiftPeriod?: unknown
  startTime?: string | null
  endTime?: string | null
  label?: string | null
}

export interface ResolvedShift {
  /** Período nominal — rótulo/filtro, nunca limita o horário. */
  shiftPeriod: ShiftPeriod
  startTime: Date
  endTime: Date
  label: string
  /** O turno termina depois da meia-noite (fim no dia seguinte ao início). */
  crossesMidnight: boolean
}

/**
 * Resolve um turno com janela livre a partir de data (YYYY-MM-DD) + horas HH:MM (Brasília).
 * Se `end <= start`, o turno atravessa a meia-noite e o fim cai no dia seguinte.
 */
export function resolveFreeShift(
  date: string,
  startHHMM: string,
  endHHMM: string,
  nominalPeriod?: unknown,
  label?: unknown
): ResolvedShift {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Data da vaga inválida (use AAAA-MM-DD).')
  if (!isHHMM(startHHMM) || !isHHMM(endHHMM)) throw new Error('Informe o horário de início e fim do turno (HH:MM).')

  const s = toMin(startHHMM)
  let e = toMin(endHHMM)
  const crossesMidnight = e <= s
  if (crossesMidnight) e += 1440

  const duration = e - s
  if (duration <= 0) throw new Error('O horário de início e o de fim do turno não podem ser iguais.')
  if (duration > MAX_SHIFT_MINUTES) throw new Error('Um turno não pode passar de 24 horas.')

  // Fuso de Brasília fixo (sem horário de verão desde 2019).
  const base = new Date(`${date}T00:00:00-03:00`)
  const period = isShiftPeriod(nominalPeriod) ? nominalPeriod : nominalPeriodFromMinutes(s)
  return {
    shiftPeriod: period,
    startTime: new Date(base.getTime() + s * 60000),
    endTime: new Date(base.getTime() + e * 60000),
    label: (typeof label === 'string' && label.trim()) || SHIFT_BOUNDS[period].label,
    crossesMidnight,
  }
}

/**
 * Resolve um ou mais turnos de uma mesma vaga.
 * - Modo livre: o turno traz `startTime` e `endTime` (HH:MM) — horário arbitrário, pode virar o dia.
 * - Modo legado: o turno traz só `shiftPeriod` — expande pela janela sugerida de `SHIFT_BOUNDS`.
 * Turnos são ordenados pelo início; sobreposição no tempo é rejeitada (lacuna/intervalo é permitido).
 * Um turno que atravessa a meia-noite precisa ser o último da lista.
 */
export function resolveShifts(rawShifts: RawShift[], date: string): ResolvedShift[] {
  if (!Array.isArray(rawShifts) || !rawShifts.length) {
    throw new Error('Adicione ao menos um turno à vaga.')
  }

  const resolved = rawShifts.map((raw) => {
    const period = raw?.nominalPeriod ?? raw?.shiftPeriod
    if (isHHMM(raw?.startTime) && isHHMM(raw?.endTime)) {
      return resolveFreeShift(date, raw!.startTime!, raw!.endTime!, period, raw?.label)
    }
    // Modo legado: só o período nominal — usa a janela sugerida.
    if (!isShiftPeriod(period)) {
      throw new Error('Informe o horário do turno (início e fim) ou um período (manhã, tarde, noite, madrugada).')
    }
    const b = SHIFT_BOUNDS[period]
    return resolveFreeShift(date, b.start, b.end === '24:00' ? '00:00' : b.end, period, raw?.label)
  })

  resolved.sort((a, b) => a.startTime.getTime() - b.startTime.getTime())

  for (let i = 0; i < resolved.length; i++) {
    if (resolved[i].crossesMidnight && i !== resolved.length - 1) {
      throw new Error('Um turno que vira o dia (fim depois da meia-noite) precisa ser o último da vaga.')
    }
    if (i > 0 && resolved[i].startTime.getTime() < resolved[i - 1].endTime.getTime()) {
      throw new Error('Os turnos da vaga não podem se sobrepor no horário.')
    }
  }

  return resolved
}

/** Compat: assinatura antiga `resolveShift(period, date, startHHMM?, endHHMM?)`. */
export function resolveShift(
  period: ShiftPeriod,
  date: string,
  startHHMM?: string | null,
  endHHMM?: string | null
): { startTime: Date; endTime: Date; label: string } {
  if (!isShiftPeriod(period)) throw new Error('Turno inválido. Use manha, tarde, noite ou madrugada.')
  const b = SHIFT_BOUNDS[period]
  const r = resolveFreeShift(
    date,
    isHHMM(startHHMM) ? startHHMM! : b.start,
    isHHMM(endHHMM) ? endHHMM! : b.end === '24:00' ? '00:00' : b.end,
    period
  )
  return { startTime: r.startTime, endTime: r.endTime, label: r.label }
}

/** Nome amigável de um período nominal. */
export function shiftPeriodLabel(period?: string | null): string {
  return isShiftPeriod(period) ? SHIFT_BOUNDS[period].label : 'Turno'
}
