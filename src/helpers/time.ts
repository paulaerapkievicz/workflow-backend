// src/helpers/time.ts

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Folga (minutos) que o check-out pode passar do turno contratado sem exigir
 * aprovação da agência para liberar o pagamento.
 */
export const CHECKOUT_OVERTIME_TOLERANCE_MINUTES = 15

/**
 * Antecedência máxima (minutos) com que o colaborador pode bater o check-in antes
 * do horário de início do turno. Atraso não é bloqueado — só a entrada muito adiantada.
 */
export const CHECKIN_EARLY_TOLERANCE_MINUTES = 30

/**
 * Dias com o pagamento retido (`settlementHold`) sem liberação a partir dos quais o relatório
 * do colaborador passa a marcar o item como "atrasado" em vez de só "a receber".
 */
export const PAYMENT_OVERDUE_HOLD_DAYS = 3

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
