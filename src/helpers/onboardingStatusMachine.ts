// src/helpers/onboardingStatusMachine.ts
//
// Fonte única da ordem das fases e das mensagens exibidas ao colaborador em cada uma — usado
// tanto pelo helper de bloqueio (`onboarding.ts`) quanto por `authController` (payload de
// `/auth/me`) e por `freelancerOnboardingStatusService` (validação das transições).

import { OnboardingStatus, ONBOARDING_STATUSES } from '../models/Freelancer'

export { ONBOARDING_STATUSES }
export type { OnboardingStatus }

export const ONBOARDING_PHASE_MESSAGES: Record<Exclude<OnboardingStatus, 'active'>, string> = {
  draft: 'Preencha seus dados e envie os documentos para iniciar o cadastro.',
  pending_docs_review: 'Cadastro em análise.',
  pending_aso_upload: 'Documentos aprovados — aguardando o exame admissional (ASO).',
  pending_contract_generation: 'Aguardando a liberação do contrato pela agência.',
  pending_user_signature: 'Contrato liberado — assine para continuar.',
  pending_final_activation: 'Contrato assinado, aguardando liberação final.',
}

/** Fase seguinte de cada fase, na ordem linear do funil (não há transição a partir de 'active'). */
export const NEXT_ONBOARDING_STATUS: Record<Exclude<OnboardingStatus, 'active'>, OnboardingStatus> = {
  draft: 'pending_docs_review',
  pending_docs_review: 'pending_aso_upload',
  pending_aso_upload: 'pending_contract_generation',
  pending_contract_generation: 'pending_user_signature',
  pending_user_signature: 'pending_final_activation',
  pending_final_activation: 'active',
}
