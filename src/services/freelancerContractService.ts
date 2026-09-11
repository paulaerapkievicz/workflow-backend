import { FreelancerContract, REQUIRED_CONTRACT_FIELDS } from '../models/FreelancerContract'
import { FreelancerInstance } from '../models/Freelancer'
import { assertField } from '../helpers/validation'

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
  'pixKey', 'emergencyContactName', 'emergencyContactPhone', 'shirtSize',
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

    const merged = { ...(existing ? existing.toJSON() : {}), ...patch }
    const completed = isComplete(merged)
    patch.completedAt = completed ? existing?.completedAt ?? new Date() : null

    if (existing) {
      await existing.update(patch)
      return existing.reload()
    }
    return FreelancerContract.create({ freelancerId: freelancer.id, ...patch } as any)
  },
}
