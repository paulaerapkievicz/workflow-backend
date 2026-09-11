// src/helpers/validation.ts
//
// Validação e normalização de campos tipados dos cadastros (documento, e-mail,
// telefone, CEP, UF, data). Regras puras, uma responsabilidade cada. Os serviços
// chamam `assertField(...)` (lança `Error` com mensagem em português e devolve o
// valor já normalizado) — o valor guardado no banco é sempre sem máscara.

import validator from 'validator'

// ----------------------------------------------------------------------------
// Base
// ----------------------------------------------------------------------------

export const onlyDigits = (value: unknown): string => String(value ?? '').replace(/\D/g, '')

const allSameChar = (value: string): boolean => value.length > 0 && /^(.)\1*$/.test(value)

// ----------------------------------------------------------------------------
// CPF
// ----------------------------------------------------------------------------

export const normalizeCpf = (value: unknown): string => onlyDigits(value)

function cpfCheckDigit(base: string, factor: number): number {
  let sum = 0
  for (const digit of base) sum += Number(digit) * factor--
  const rest = (sum * 10) % 11
  return rest === 10 ? 0 : rest
}

export function isValidCpf(value: unknown): boolean {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11 || allSameChar(cpf)) return false
  if (cpfCheckDigit(cpf.slice(0, 9), 10) !== Number(cpf[9])) return false
  return cpfCheckDigit(cpf.slice(0, 10), 11) === Number(cpf[10])
}

// ----------------------------------------------------------------------------
// CNPJ — aceita o formato numérico (14 dígitos) e o novo CNPJ alfanumérico
// (12 caracteres [0-9A-Z] + 2 dígitos verificadores numéricos). O valor de
// cada caractere na conta dos DV é `código ASCII − 48` (assim '0'..'9' → 0..9
// e 'A'..'Z' → 17..42), então um único caminho cobre os dois casos.
// ----------------------------------------------------------------------------

export const normalizeCnpj = (value: unknown): string =>
  String(value ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')

const CNPJ_FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
const CNPJ_SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

const cnpjCharValue = (ch: string): number => ch.charCodeAt(0) - 48

function cnpjCheckDigit(base: string, weights: number[]): number {
  let sum = 0
  for (let i = 0; i < weights.length; i++) sum += cnpjCharValue(base[i]) * weights[i]
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function isValidCnpj(value: unknown): boolean {
  const cnpj = normalizeCnpj(value)
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj) || allSameChar(cnpj)) return false
  if (cnpjCheckDigit(cnpj.slice(0, 12), CNPJ_FIRST_WEIGHTS) !== Number(cnpj[12])) return false
  return cnpjCheckDigit(cnpj.slice(0, 13), CNPJ_SECOND_WEIGHTS) === Number(cnpj[13])
}

// ----------------------------------------------------------------------------
// Documento (CPF ou CNPJ)
// ----------------------------------------------------------------------------

export function isValidDocument(value: unknown): boolean {
  const digits = onlyDigits(value)
  if (digits.length === 11) return isValidCpf(value)
  return isValidCnpj(value)
}

export function normalizeDocument(value: unknown): string {
  const digits = onlyDigits(value)
  return digits.length === 11 ? digits : normalizeCnpj(value)
}

// ----------------------------------------------------------------------------
// E-mail
// ----------------------------------------------------------------------------

export const normalizeEmail = (value: unknown): string => String(value ?? '').trim().toLowerCase()

export const isValidEmail = (value: unknown): boolean => validator.isEmail(normalizeEmail(value))

// ----------------------------------------------------------------------------
// Telefone (Brasil) — guarda só dígitos, sem o código do país
// ----------------------------------------------------------------------------

export function normalizePhone(value: unknown): string {
  let digits = onlyDigits(value)
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2)
  }
  return digits
}

export function isValidBrPhone(value: unknown): boolean {
  const phone = normalizePhone(value)
  if (phone.length !== 10 && phone.length !== 11) return false
  const ddd = Number(phone.slice(0, 2))
  if (ddd < 11 || ddd > 99) return false
  // Celular (11 dígitos) tem o 9 na terceira posição; fixo (10) não começa com 0/1.
  if (phone.length === 11) return phone[2] === '9'
  return !['0', '1'].includes(phone[2])
}

// ----------------------------------------------------------------------------
// CEP
// ----------------------------------------------------------------------------

export const normalizeCep = (value: unknown): string => onlyDigits(value)
export const isValidCep = (value: unknown): boolean => normalizeCep(value).length === 8

// ----------------------------------------------------------------------------
// UF
// ----------------------------------------------------------------------------

export const BR_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export const normalizeUf = (value: unknown): string => String(value ?? '').trim().toUpperCase()
export const isValidUf = (value: unknown): boolean => (BR_UFS as readonly string[]).includes(normalizeUf(value))

// ----------------------------------------------------------------------------
// Datas
// ----------------------------------------------------------------------------

/** 'AAAA-MM-DD' que corresponde a uma data de calendário real. */
export function isValidDateOnly(value: unknown): boolean {
  const raw = String(value ?? '').trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** Data de nascimento plausível: data real, idade entre 14 e 100 anos. */
export function isPlausibleBirthDate(value: unknown): boolean {
  if (!isValidDateOnly(value)) return false
  const birth = new Date(`${String(value).trim()}T00:00:00Z`)
  const now = new Date()
  const age = (now.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000)
  return age >= 14 && age <= 100
}

// ----------------------------------------------------------------------------
// Exibição (mascarar) — usado onde o back monta texto (PDF, verificação pública)
// ----------------------------------------------------------------------------

export function maskCpfForDisplay(value: unknown): string {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) return '***'
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`
}

/** Reaplica a máscara para exibição (documentos guardados sem máscara no banco). */
export function formatCpf(value: unknown): string {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) return String(value ?? '')
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

export function formatCnpj(value: unknown): string {
  const c = normalizeCnpj(value)
  if (c.length !== 14) return String(value ?? '')
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
}

export function formatDocument(value: unknown): string {
  return onlyDigits(value).length === 11 ? formatCpf(value) : formatCnpj(value)
}

export function formatCep(value: unknown): string {
  const cep = normalizeCep(value)
  return cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : String(value ?? '')
}

export function formatPhone(value: unknown): string {
  const p = normalizePhone(value)
  if (p.length === 11) return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`
  if (p.length === 10) return `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}`
  return String(value ?? '')
}

// ----------------------------------------------------------------------------
// Orquestrador
// ----------------------------------------------------------------------------

export type FieldKind =
  | 'cpf'
  | 'cnpj'
  | 'document'
  | 'email'
  | 'phone'
  | 'cep'
  | 'uf'
  | 'date'
  | 'birthDate'
  | 'digits'

interface AssertOptions {
  /** Campo obrigatório? Se `false` (padrão), valor vazio devolve string vazia. */
  required?: boolean
  /** Para `kind: 'digits'` — exige exatamente esse número de dígitos. */
  length?: number
}

const KIND_RULES: Record<
  Exclude<FieldKind, 'digits'>,
  { valid: (v: unknown) => boolean; normalize: (v: unknown) => string; problem: string }
> = {
  cpf: { valid: isValidCpf, normalize: normalizeCpf, problem: 'não é um CPF válido' },
  cnpj: { valid: isValidCnpj, normalize: normalizeCnpj, problem: 'não é um CNPJ válido' },
  document: { valid: isValidDocument, normalize: normalizeDocument, problem: 'não é um CPF/CNPJ válido' },
  email: { valid: isValidEmail, normalize: normalizeEmail, problem: 'não é um e-mail válido' },
  phone: { valid: isValidBrPhone, normalize: normalizePhone, problem: 'não é um telefone válido' },
  cep: { valid: isValidCep, normalize: normalizeCep, problem: 'não é um CEP válido' },
  uf: { valid: isValidUf, normalize: normalizeUf, problem: 'não é uma UF válida' },
  date: { valid: isValidDateOnly, normalize: (v) => String(v ?? '').trim(), problem: 'não é uma data válida' },
  birthDate: {
    valid: isPlausibleBirthDate,
    normalize: (v) => String(v ?? '').trim(),
    problem: 'não é uma data de nascimento válida',
  },
}

/**
 * Valida `value` conforme o `kind` e devolve o valor normalizado (sem máscara).
 * Lança `Error` com mensagem em português quando inválido. `fieldLabel` é o nome
 * do campo mostrado na mensagem (ex.: "CNPJ da agência").
 */
export function assertField(
  value: unknown,
  fieldLabel: string,
  kind: FieldKind,
  options: AssertOptions = {}
): string {
  const raw = String(value ?? '').trim()

  if (!raw) {
    if (options.required) throw new Error(`Informe ${fieldLabel}.`)
    return ''
  }

  if (kind === 'digits') {
    const digits = onlyDigits(raw)
    if (options.length && digits.length !== options.length) {
      throw new Error(`${fieldLabel} deve ter ${options.length} dígitos.`)
    }
    if (!digits) throw new Error(`${fieldLabel} deve conter apenas números.`)
    return digits
  }

  const rule = KIND_RULES[kind]
  if (!rule.valid(raw)) throw new Error(`${fieldLabel} ${rule.problem}.`)
  return rule.normalize(raw)
}
