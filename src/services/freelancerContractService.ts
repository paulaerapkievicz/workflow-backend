import { FreelancerContract, REQUIRED_CONTRACT_FIELDS } from '../models/FreelancerContract'
import { FreelancerInstance } from '../models/Freelancer'

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
      if (data[field] !== undefined) patch[field] = data[field] === '' ? null : data[field]
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
