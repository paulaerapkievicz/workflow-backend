// src/services/freelancerOnboardingStatusService.ts
//
// Dono das transições do funil único de onboarding (helpers/onboardingStatusMachine.ts). Cada
// função corresponde a um gatilho do fluxo: envio do pré-cadastro pelo colaborador, ou uma ação
// da agência (aprovar/recusar documentos, anexar ASO, liberar contrato, ativar).

import { Op } from 'sequelize'
import { Freelancer, FreelancerInstance, ONBOARDING_STATUSES, OnboardingStatus } from '../models/Freelancer'
import { UniformOrder } from '../models/UniformOrder'
import { Agency } from '../models/Agency'
import { FreelancerContractSignature } from '../models/FreelancerContractSignature'
import { freelancerContractService } from './freelancerContractService'
import { contractTemplateService } from './contractTemplateService'
import { contractMergeService } from './contractMergeService'

function assertStatus(freelancer: FreelancerInstance, expected: OnboardingStatus, message: string) {
  if (freelancer.onboardingStatus !== expected) throw new Error(message)
}

async function loadFreelancerForAgency(freelancerId: string, agencyId: string) {
  const freelancer = await Freelancer.findOne({ where: { id: freelancerId, agencyId } })
  if (!freelancer) throw new Error('Colaborador não encontrado.')
  return freelancer
}

const BOARD_PHASES = ONBOARDING_STATUSES.filter(
  (s): s is Exclude<OnboardingStatus, 'draft' | 'active'> => s !== 'draft' && s !== 'active'
)

export const freelancerOnboardingStatusService = {
  /** Fase 1 (colaborador): envia dados do pré-cadastro + as 3 fotos de documento. */
  async submitDocuments(
    freelancer: FreelancerInstance,
    contractData: Record<string, unknown>,
    photos: { documentIdPhotoUrl?: string; addressProofPhotoUrl?: string; documentSelfiePhotoUrl?: string }
  ) {
    if (freelancer.onboardingStatus !== 'draft') {
      throw new Error('O cadastro já foi enviado e está em análise.')
    }

    const contract = await freelancerContractService.upsert(freelancer, contractData)
    if (!contract.completedAt) {
      throw new Error('Preencha todos os dados obrigatórios do cadastro.')
    }

    const documentIdPhotoUrl = photos.documentIdPhotoUrl ?? freelancer.documentIdPhotoUrl
    const addressProofPhotoUrl = photos.addressProofPhotoUrl ?? freelancer.addressProofPhotoUrl
    const documentSelfiePhotoUrl = photos.documentSelfiePhotoUrl ?? freelancer.documentSelfiePhotoUrl
    if (!documentIdPhotoUrl || !addressProofPhotoUrl || !documentSelfiePhotoUrl) {
      throw new Error('Envie a foto do RG/CNH, a foto do comprovante de residência e a selfie do documento.')
    }

    await freelancer.update({
      documentIdPhotoUrl,
      addressProofPhotoUrl,
      documentSelfiePhotoUrl,
      onboardingStatus: 'pending_docs_review',
      onboardingStatusReason: null,
    })
    return freelancer.reload()
  },

  /** Fase 2 (agência): "Aprovar Documentos". */
  async approveDocuments(freelancerId: string, agencyId: string) {
    const freelancer = await loadFreelancerForAgency(freelancerId, agencyId)
    assertStatus(freelancer, 'pending_docs_review', 'Este colaborador não está na etapa de revisão de documentos.')
    await freelancer.update({ onboardingStatus: 'pending_aso_upload', onboardingStatusReason: null })
    return freelancer.reload()
  },

  /** Recusa da triagem (não descrito no fluxo original, mas necessário) — devolve pro pré-cadastro. */
  async rejectDocuments(freelancerId: string, agencyId: string, reason: string) {
    const freelancer = await loadFreelancerForAgency(freelancerId, agencyId)
    assertStatus(freelancer, 'pending_docs_review', 'Este colaborador não está na etapa de revisão de documentos.')
    const trimmed = String(reason ?? '').trim()
    if (!trimmed) throw new Error('Informe o motivo da recusa.')
    await freelancer.update({ onboardingStatus: 'draft', onboardingStatusReason: trimmed })
    return freelancer.reload()
  },

  /** Fase 3 (agência): anexa o PDF do ASO (exame admissional feito por telemedicina, externo). */
  async uploadAso(freelancerId: string, agencyId: string, asoDocumentUrl: string) {
    const freelancer = await loadFreelancerForAgency(freelancerId, agencyId)
    assertStatus(freelancer, 'pending_aso_upload', 'Este colaborador não está na etapa de exame admissional.')
    if (!asoDocumentUrl) throw new Error('Envie o PDF do ASO.')
    await freelancer.update({
      onboardingStatus: 'pending_contract_generation',
      asoDocumentUrl,
      onboardingStatusReason: null,
    })
    return freelancer.reload()
  },

  /** Fase 4 (agência): "Liberar Contrato" — exige modelo ativo sem tokens de mesclagem faltando. */
  async releaseContract(freelancerId: string, agencyId: string) {
    const freelancer = await loadFreelancerForAgency(freelancerId, agencyId)
    assertStatus(freelancer, 'pending_contract_generation', 'Este colaborador não está na etapa de liberação do contrato.')
    const template = await contractTemplateService.activeForAgency(agencyId)
    if (!template) throw new Error('Cadastre um modelo de contrato ativo antes de liberar o contrato.')
    const ctx = await contractMergeService.buildContext(freelancer.id)
    const { missing } = contractMergeService.render(template.bodyHtml, ctx)
    if (missing.length) {
      throw new Error(`Faltam dados no cadastro do colaborador para gerar o contrato: ${missing.join(', ')}.`)
    }
    await freelancer.update({ onboardingStatus: 'pending_user_signature', onboardingStatusReason: null })
    return freelancer.reload()
  },

  /** Fase 5 (colaborador): chamado pelo controller logo após `freelancerContractSignatureService.sign()`. */
  async advanceAfterSignature(freelancer: FreelancerInstance) {
    assertStatus(freelancer, 'pending_user_signature', 'Este colaborador não está na etapa de assinatura do contrato.')
    await freelancer.update({ onboardingStatus: 'pending_final_activation' })
    return freelancer.reload()
  },

  /** Fase 6 (agência): "Ativar Colaborador" — confere assinatura + uniforme/foto quando exigidos. */
  async activate(freelancerId: string, agencyId: string) {
    const freelancer = await loadFreelancerForAgency(freelancerId, agencyId)
    assertStatus(freelancer, 'pending_final_activation', 'Este colaborador não está na etapa de ativação final.')

    const signed = await FreelancerContractSignature.count({ where: { freelancerId, status: 'signed' } })
    if (!signed) throw new Error('O colaborador ainda não assinou o contrato.')

    const agency = await Agency.findByPk(agencyId)
    if (agency?.requireUniformPurchase) {
      const order = await UniformOrder.findOne({ where: { freelancerId }, order: [['createdAt', 'DESC']] })
      if (!order || order.status !== 'delivered') {
        throw new Error('O uniforme do colaborador ainda não foi entregue e confirmado.')
      }
    }
    if (agency?.requirePhotoApproval && freelancer.profilePhotoStatus !== 'approved') {
      throw new Error('A foto de perfil do colaborador ainda não foi aprovada.')
    }

    await freelancer.update({
      onboardingStatus: 'active',
      onboardingActivatedAt: new Date(),
      onboardingStatusReason: null,
    })
    return freelancer.reload()
  },

  /** Esteira da agência: colaboradores agrupados pelas 5 fases intermediárias do funil. */
  async listBoard(agencyId: string) {
    const freelancers = await Freelancer.findAll({
      where: { agencyId, onboardingStatus: { [Op.in]: [...BOARD_PHASES] } },
      attributes: [
        'id', 'name', 'email', 'onboardingStatus', 'onboardingStatusReason',
        'documentIdPhotoUrl', 'addressProofPhotoUrl', 'documentSelfiePhotoUrl', 'asoDocumentUrl',
        'updatedAt',
      ],
      order: [['updatedAt', 'ASC']],
    })

    const board: Record<string, FreelancerInstance[]> = {}
    for (const phase of BOARD_PHASES) board[phase] = []
    for (const freelancer of freelancers) board[freelancer.onboardingStatus].push(freelancer)
    return board
  },
}
