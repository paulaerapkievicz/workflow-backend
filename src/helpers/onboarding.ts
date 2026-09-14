// src/helpers/onboarding.ts
//
// Regra de bloqueio do onboarding — usada tanto para liberar vagas (jobService) quanto para
// liberar a assinatura do contrato (freelancerContractSignatureService) e o status exibido em
// /auth/me (authController). Calculada ao vivo (sem cache) a partir de três condições
// independentes: perfil contratual, compra do uniforme (se exigida) e aprovação da foto (se exigida).

import { FreelancerInstance } from '../models/Freelancer'
import { FreelancerContract } from '../models/FreelancerContract'
import { Agency } from '../models/Agency'
import { UniformOrder } from '../models/UniformOrder'

/**
 * Se a agência exige onboarding, o colaborador só trabalha depois de concluir o perfil
 * contratual e, quando exigidos pela agência, receber o uniforme e ter a foto aprovada.
 * Retorna a mensagem de bloqueio ou null.
 */
export async function onboardingBlockReason(freelancer: FreelancerInstance): Promise<string | null> {
  if (!freelancer.agencyId) return null
  const agency = await Agency.findByPk(freelancer.agencyId)
  if (!agency?.onboardingRequired) return null

  const contract = await FreelancerContract.findOne({ where: { freelancerId: freelancer.id } })
  if (!contract?.completedAt) return 'Preencha o perfil contratual para aceitar vagas.'

  if (agency.requireUniformPurchase) {
    const order = await UniformOrder.findOne({
      where: { freelancerId: freelancer.id },
      order: [['createdAt', 'DESC']],
    })
    if (!order || order.status !== 'delivered') {
      return 'Aguarde receber e confirmar o uniforme para aceitar vagas.'
    }
  }

  if (agency.requirePhotoApproval) {
    if (freelancer.profilePhotoStatus !== 'approved') {
      return 'Aguarde a aprovação da sua foto para aceitar vagas.'
    }
  }

  return null
}
