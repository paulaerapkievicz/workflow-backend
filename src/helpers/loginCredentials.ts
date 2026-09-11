// src/helpers/loginCredentials.ts
//
// Resolve o e-mail de login e gera a senha temporária de reset conforme a política da agência
// (Agency.loginEmailPolicy): 'informed' usa o e-mail que a pessoa informou; 'pattern' gera
// nomesobrenome@workflow.com. Ver CLAUDE.md — funcionalidade de reset de senha pela agência.

import { Op } from 'sequelize'
import { User } from '../models/User'
import { Agency } from '../models/Agency'

const DIACRITICS_REGEX = new RegExp('[̀-ͯ]', 'g')

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS_REGEX, '')
}

function slugifyNamePart(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function nameTokens(fullName: string): string[] {
  return fullName.trim().split(/\s+/).filter(Boolean)
}

/** Primeiro + último token do nome, concatenados e sem acento/espaço — base do e-mail padrão. */
export function buildPatternEmailBase(fullName: string): string {
  const tokens = nameTokens(fullName)
  const first = slugifyNamePart(tokens[0] ?? '')
  const last = tokens.length > 1 ? slugifyNamePart(tokens[tokens.length - 1]) : ''
  return `${first}${last}` || 'usuario'
}

/** Senha temporária de reset: primeiro nome + "workflow" + ano atual (ex.: joaoworkflow2026). */
export function buildPatternPassword(fullName: string): string {
  const tokens = nameTokens(fullName)
  const first = slugifyNamePart(tokens[0] ?? '') || 'usuario'
  const year = new Date().getFullYear()
  return `${first}workflow${year}`
}

/**
 * Resolve o e-mail de login de uma nova conta sob `agencyId` conforme a política da agência.
 * `agencyId` null (ex.: cadastro de uma agência nova, sem "agência mãe") sempre usa o e-mail
 * informado. Em 'pattern', gera nomesobrenome@workflow.com e resolve colisão com sufixo 2, 3...
 */
export async function resolveLoginEmail(
  agencyId: string | null,
  informedEmail: string,
  fullName: string
): Promise<string> {
  if (!agencyId) return informedEmail
  const agency = await Agency.findByPk(agencyId)
  if (!agency || agency.loginEmailPolicy !== 'pattern') return informedEmail

  const base = buildPatternEmailBase(fullName)
  let candidate = `${base}@workflow.com`
  let suffix = 2
  while (await User.findOne({ where: { email: candidate } })) {
    candidate = `${base}${suffix}@workflow.com`
    suffix += 1
  }
  return candidate
}

/**
 * Checa duplicidade de cadastro pelo e-mail informado — olha tanto `email` (login, pode já ser
 * o e-mail informado hoje) quanto `contactEmail` (login pode ter virado o padrão @workflow.com).
 */
export async function emailAlreadyRegistered(rawEmail: string): Promise<boolean> {
  const found = await User.findOne({
    where: { [Op.or]: [{ email: rawEmail }, { contactEmail: rawEmail }] } as any,
  })
  return !!found
}
