import { FreelancerContract, REQUIRED_CONTRACT_FIELDS, FREELANCER_PIX_KEY_TYPES } from '../models/FreelancerContract'
import { FreelancerInstance } from '../models/Freelancer'
import { assertField, normalizeCpf, normalizeEmail, normalizePhone } from '../helpers/validation'

/** Normalizadores dos campos tipados do perfil contratual (só rodam quando há valor). */
const CONTRACT_FIELD_NORMALIZERS: Record<string, (v: unknown) => string> = {
  cpf: (v) => assertField(v, 'O CPF', 'cpf'),
  pisNis: (v) => assertField(v, 'O PIS/NIS', 'digits', { length: 11 }),
  birthDate: (v) => assertField(v, 'A data de nascimento', 'birthDate'),
  addressCep: (v) => assertField(v, 'O CEP', 'cep'),
  addressState: (v) => assertField(v, 'A UF', 'uf'),
  emergencyContactPhone: (v) => assertField(v, 'O telefone de emergência', 'phone'),
  bankBranch: (v) => assertField(v, 'A agência bancária', 'digits'),
  bankAccount: (v) => assertField(v, 'A conta bancária', 'digits'),
}

const EDITABLE_FIELDS = [
  'fullName', 'cpf', 'rg', 'rgIssuer', 'pisNis', 'birthDate', 'gender', 'maritalStatus',
  'nationality', 'motherName', 'fatherName', 'educationLevel', 'ctpsNumber', 'ctpsSeries',
  'addressCep', 'addressStreet', 'addressNumber', 'addressComplement', 'addressNeighborhood',
  'addressCity', 'addressState', 'bankName', 'bankBranch', 'bankAccount', 'bankAccountType',
  'pixKey', 'pixKeyType', 'emergencyContactName', 'emergencyContactPhone', 'shirtSize',
] as const

function isComplete(row: Record<string, unknown>): boolean {
  return REQUIRED_CONTRACT_FIELDS.every((f) => {
    const v = row[f]
    return v != null && String(v).trim() !== ''
  })
}

export const freelancerContractService = {
  async getForFreelancer(freelancerId: string) {
    return FreelancerContract.findOne({ where: { freelancerId } })
  },

  /** Upsert do perfil contratual; grava `completedAt` quando todos os campos obrigatórios estão preenchidos. */
  async upsert(freelancer: FreelancerInstance, data: Record<string, unknown>) {
    const existing = await FreelancerContract.findOne({ where: { freelancerId: freelancer.id } })
    const patch: Record<string, unknown> = {}
    for (const field of EDITABLE_FIELDS) {
      if (data[field] === undefined) continue
      const raw = data[field]
      if (raw === '' || raw == null) {
        patch[field] = null
        continue
      }
      const normalize = CONTRACT_FIELD_NORMALIZERS[field]
      patch[field] = normalize ? normalize(raw) : raw
    }

    const merged: Record<string, unknown> = { ...(existing ? existing.toJSON() : {}), ...patch }

    // Chave Pix só pode ser do próprio colaborador — nunca de terceiros. Cada tipo de chave é
    // conferido contra o dado equivalente já cadastrado (CPF do perfil, e-mail/telefone da conta).
    // Chave aleatória não tem como ser conferida sem integração com o Banco Central.
    if (patch.pixKey !== undefined || patch.pixKeyType !== undefined) {
      const rawType = merged.pixKeyType ? String(merged.pixKeyType).trim() : ''
      const rawKey = merged.pixKey ? String(merged.pixKey).trim() : ''

      if (!rawType && !rawKey) {
        patch.pixKey = null
        patch.pixKeyType = null
        merged.pixKey = null
        merged.pixKeyType = null
      } else {
        if (!rawType) throw new Error('Selecione o tipo da chave Pix.')
        if (!(FREELANCER_PIX_KEY_TYPES as readonly string[]).includes(rawType)) {
          throw new Error('Tipo de chave Pix inválido.')
        }
        if (!rawKey) throw new Error('Informe a chave Pix.')

        let normalizedKey = rawKey
        if (rawType === 'cpf') {
          normalizedKey = assertField(rawKey, 'A chave Pix (CPF)', 'cpf', { required: true })
          const ownCpf = normalizeCpf(merged.cpf)
          if (!ownCpf) throw new Error('Preencha o seu CPF antes de cadastrar a chave Pix por CPF.')
          if (normalizedKey !== ownCpf) {
            throw new Error('A chave Pix por CPF precisa ser o seu próprio CPF — não pode ser de terceiros.')
          }
        } else if (rawType === 'email') {
          normalizedKey = assertField(rawKey, 'A chave Pix (e-mail)', 'email', { required: true })
          if (normalizedKey !== normalizeEmail(freelancer.email)) {
            throw new Error('A chave Pix por e-mail precisa ser o seu próprio e-mail cadastrado — não pode ser de terceiros.')
          }
        } else if (rawType === 'telefone') {
          normalizedKey = assertField(rawKey, 'A chave Pix (telefone)', 'phone', { required: true })
          const ownPhone = normalizePhone(freelancer.phone)
          if (!ownPhone || normalizedKey !== ownPhone) {
            throw new Error('A chave Pix por telefone precisa ser o seu próprio telefone cadastrado — não pode ser de terceiros.')
          }
        }

        patch.pixKey = normalizedKey
        patch.pixKeyType = rawType
        merged.pixKey = normalizedKey
        merged.pixKeyType = rawType
      }
    }

    const completed = isComplete(merged)
    patch.completedAt = completed ? existing?.completedAt ?? new Date() : null

    if (existing) {
      await existing.update(patch)
      return existing.reload()
    }
    return FreelancerContract.create({ freelancerId: freelancer.id, ...patch } as any)
  },
}
