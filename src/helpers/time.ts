// src/helpers/time.ts

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const minutesBetween = (start: Date | string, end: Date | string) =>
  Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))

/** 'YYYY-MM' de uma data (fuso local do servidor). */
export const referenceMonthOf = (d: Date | string) => {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}

/** Intervalo [início, fim) do mês de referência 'YYYY-MM'. */
export const monthRange = (referenceMonth: string) => {
  const [y, m] = referenceMonth.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) throw new Error('Mês de referência inválido (use AAAA-MM).')
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0)
  const end = new Date(y, m, 1, 0, 0, 0, 0)
  return { start, end }
}
