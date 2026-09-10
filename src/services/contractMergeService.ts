// src/services/contractMergeService.ts
//
// Campos de mesclagem do contrato: monta o contexto de tokens a partir do onboarding do
// colaborador (Freelancer + FreelancerContract) e do perfil da agência, e substitui os
// `{{token}}` no HTML do modelo.

import { Freelancer } from '../models/Freelancer'
import { FreelancerContract } from '../models/FreelancerContract'
import { Agency } from '../models/Agency'
import { escapeHtml } from '../helpers/contractDocument'

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function fmtDateBR(value?: string | Date | null): string {
  if (!value) return ''
  const s = String(value)
  const iso = s.length >= 10 ? s.slice(0, 10) : s
  const [y, m, d] = iso.split('-')
  if (y && m && d) return `${d}/${m}/${y}`
  const dt = new Date(value)
  return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pt-BR')
}

function dateInExtenso(city: string): string {
  const now = new Date()
  const base = `${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`
  return city ? `${city}, ${base}` : base
}

/** Descrição dos tokens disponíveis — usada pelo editor da agência ("Inserir campo"). */
export const CONTRACT_TOKENS: { token: string; label: string }[] = [
  { token: 'fullName', label: 'Nome completo do colaborador' },
  { token: 'cpf', label: 'CPF' },
  { token: 'rg', label: 'RG' },
  { token: 'rgIssuer', label: 'Órgão emissor do RG' },
  { token: 'pisNis', label: 'PIS/NIS' },
  { token: 'birthDate', label: 'Data de nascimento' },
  { token: 'maritalStatus', label: 'Estado civil' },
  { token: 'nationality', label: 'Nacionalidade' },
  { token: 'motherName', label: 'Nome da mãe' },
  { token: 'fatherName', label: 'Nome do pai' },
  { token: 'ctpsNumber', label: 'CTPS - número' },
  { token: 'ctpsSeries', label: 'CTPS - série' },
  { token: 'address', label: 'Endereço completo do colaborador' },
  { token: 'addressStreet', label: 'Logradouro' },
  { token: 'addressNumber', label: 'Número' },
  { token: 'addressComplement', label: 'Complemento' },
  { token: 'addressNeighborhood', label: 'Bairro' },
  { token: 'addressCity', label: 'Cidade' },
  { token: 'addressState', label: 'UF' },
  { token: 'addressCep', label: 'CEP' },
  { token: 'bankName', label: 'Banco' },
  { token: 'bankBranch', label: 'Agência bancária' },
  { token: 'bankAccount', label: 'Conta bancária' },
  { token: 'pixKey', label: 'Chave Pix' },
  { token: 'phone', label: 'Telefone do colaborador' },
  { token: 'email', label: 'E-mail do colaborador' },
  { token: 'emergencyContactName', label: 'Contato de emergência - nome' },
  { token: 'emergencyContactPhone', label: 'Contato de emergência - telefone' },
  { token: 'shirtSize', label: 'Tamanho da camiseta' },
  { token: 'agencyName', label: 'Nome fantasia da agência' },
  { token: 'agencyLegalName', label: 'Razão social da agência' },
  { token: 'agencyCnpj', label: 'CNPJ da agência' },
  { token: 'agencyAddress', label: 'Endereço da agência' },
  { token: 'agencyPhone', label: 'Telefone da agência' },
  { token: 'agencyEmail', label: 'E-mail da agência' },
  { token: 'dataAtual', label: 'Data de hoje (DD/MM/AAAA)' },
  { token: 'dataPorExtenso', label: 'Cidade e data por extenso' },
]

export const contractMergeService = {
  /** Monta o mapa de tokens (valores crus). Lança se o colaborador/contrato não existir. */
  async buildContext(freelancerId: string): Promise<Record<string, string>> {
    const freelancer = await Freelancer.findByPk(freelancerId)
    if (!freelancer) throw new Error('Colaborador não encontrado.')
    const contract = await FreelancerContract.findOne({ where: { freelancerId } })
    const agency = freelancer.agencyId ? await Agency.findByPk(freelancer.agencyId) : null
    const c: any = contract ? contract.toJSON() : {}

    const addressParts = [
      c.addressStreet && c.addressNumber ? `${c.addressStreet}, ${c.addressNumber}` : c.addressStreet,
      c.addressComplement,
      c.addressNeighborhood,
      c.addressCity && c.addressState ? `${c.addressCity}/${c.addressState}` : c.addressCity,
      c.addressCep ? `CEP ${c.addressCep}` : null,
    ].filter(Boolean)

    const raw: Record<string, unknown> = {
      fullName: c.fullName || freelancer.name,
      cpf: c.cpf,
      rg: c.rg,
      rgIssuer: c.rgIssuer,
      pisNis: c.pisNis,
      birthDate: fmtDateBR(c.birthDate),
      maritalStatus: c.maritalStatus,
      nationality: c.nationality,
      motherName: c.motherName,
      fatherName: c.fatherName,
      ctpsNumber: c.ctpsNumber,
      ctpsSeries: c.ctpsSeries,
      address: addressParts.join(' - '),
      addressStreet: c.addressStreet,
      addressNumber: c.addressNumber,
      addressComplement: c.addressComplement,
      addressNeighborhood: c.addressNeighborhood,
      addressCity: c.addressCity,
      addressState: c.addressState,
      addressCep: c.addressCep,
      bankName: c.bankName,
      bankBranch: c.bankBranch,
      bankAccount: c.bankAccount,
      pixKey: c.pixKey,
      phone: freelancer.phone,
      email: freelancer.email,
      emergencyContactName: c.emergencyContactName,
      emergencyContactPhone: c.emergencyContactPhone,
      shirtSize: c.shirtSize,
      agencyName: agency?.name,
      agencyLegalName: agency?.legalName || agency?.name,
      agencyCnpj: agency?.cnpj,
      agencyAddress: agency?.address,
      agencyPhone: agency?.phone,
      agencyEmail: agency?.email,
      dataAtual: fmtDateBR(new Date()),
      dataPorExtenso: dateInExtenso(c.addressCity || agency?.address?.split(',').pop()?.trim() || ''),
    }
    const ctx: Record<string, string> = {}
    for (const [k, v] of Object.entries(raw)) ctx[k] = v == null ? '' : String(v)
    return ctx
  },

  /**
   * Substitui `{{ token }}` no HTML. Valores são escapados (dados do colaborador podem
   * conter `<`). Retorna a lista de tokens que ficaram sem valor.
   */
  render(html: string, ctx: Record<string, string>): { html: string; missing: string[] } {
    const missing = new Set<string>()
    const rendered = String(html ?? '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, token: string) => {
      const value = ctx[token]
      if (value === undefined) { missing.add(token); return `{{${token}}}` }
      if (value === '') missing.add(token)
      return escapeHtml(value)
    })
    return { html: rendered, missing: [...missing] }
  },
}
