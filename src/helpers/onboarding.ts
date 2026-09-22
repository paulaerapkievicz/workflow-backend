// src/helpers/onboarding.ts
//
// Regra de bloqueio do onboarding — usada tanto para liberar vagas (jobService) quanto para
// exibir o status em /auth/me (authController). O colaborador só trabalha quando o funil
// (helpers/onboardingStatusMachine.ts) chega em 'active'; enquanto isso, devolve a mensagem em
// PT-BR da fase atual.

import { FreelancerInstance } from '../models/Freelancer'
import { ONBOARDING_PHASE_MESSAGES } from './onboardingStatusMachine'

export async function onboardingBlockReason(freelancer: FreelancerInstance): Promise<string | null> {
  if (freelancer.onboardingStatus === 'active') return null
  return ONBOARDING_PHASE_MESSAGES[freelancer.onboardingStatus]
}
