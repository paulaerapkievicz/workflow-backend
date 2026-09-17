// src/services/freelancerContractSignatureService.ts

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { FreelancerInstance } from '../models/Freelancer'
import { FreelancerContract } from '../models/FreelancerContract'
import { Agency } from '../models/Agency'
import { Freelancer } from '../models/Freelancer'
import { FreelancerContractSignature } from '../models/FreelancerContractSignature'
import { contractTemplateService } from './contractTemplateService'
import { contractMergeService } from './contractMergeService'
import { contractPdfService } from './contractPdfService'
import { assertField, maskCpfForDisplay } from '../helpers/validation'

const CONTRACTS_DIR = path.resolve(__dirname, '..', '..', 'public', 'uploads', 'contracts')

export const ACCEPTANCE_TEXT =
  'Declaro que li o contrato apresentado, que as informações do meu cadastro estão corretas e que ' +
  'concordo com todos os seus termos, assinando-o eletronicamente.'

const sha256 = (text: string) => crypto.createHash('sha256').update(text, 'utf8').digest('hex')

async function renderActiveTemplate(freelancer: FreelancerInstance) {
  const template = freelancer.agencyId
    ? await contractTemplateService.activeForAgency(freelancer.agencyId)
    : null
  if (!template) return { template: null as null, renderedHtml: '', missing: [] as string[] }
  const ctx = await contractMergeService.buildContext(freelancer.id)
  const { html, missing } = contractMergeService.render(template.bodyHtml, ctx)
  return { template, renderedHtml: html, missing }
}

export const freelancerContractSignatureService = {
  /** Estado do contrato para a área do colaborador. */
  async agreementFor(freelancer: FreelancerInstance) {
    const contract = await FreelancerContract.findOne({ where: { freelancerId: freelancer.id } })
    const { template, renderedHtml, missing } = await renderActiveTemplate(freelancer)
    const contractComplete = !!contract?.completedAt
    // A assinatura só libera depois que a agência revisou e confirmou os dados do onboarding
    // (`freelancerContractService.approve`) — não basta o perfil estar completo.
    const onboardingApproved = !!contract?.approvedAt

    const lastSigned = await FreelancerContractSignature.findOne({
      where: { freelancerId: freelancer.id, status: 'signed' },
      order: [['signedAt', 'DESC']],
    })
    const currentHash = template ? sha256(renderedHtml) : null
    const signedCurrent = !!(lastSigned && currentHash && lastSigned.contentHash === currentHash)
    const supersededSignature = !!(lastSigned && !signedCurrent)

    let blockedReason: string | null = null
    if (!template) blockedReason = 'A sua agência ainda não publicou um modelo de contrato.'
    else if (!contractComplete) blockedReason = 'Preencha todos os dados do perfil contratual no onboarding.'
    else if (!onboardingApproved) blockedReason = 'Aguarde a agência revisar e aprovar os dados do seu onboarding.'
    else if (missing.length) blockedReason = `Faltam dados no seu cadastro para preencher o contrato: ${missing.join(', ')}.`

    return {
      hasTemplate: !!template,
      templateTitle: template?.title ?? null,
      renderedHtml,
      missing,
      onboardingApproved,
      contractComplete,
      signerName: contract?.fullName || freelancer.name,
      signerCpf: contract?.cpf || null,
      signedCurrent,
      supersededSignature,
      canSign: !!template && onboardingApproved && contractComplete && missing.length === 0 && !signedCurrent,
      blockedReason: signedCurrent ? null : blockedReason,
      signature: lastSigned ? this.serialize(lastSigned) : null,
    }
  },

  async sign(
    freelancer: FreelancerInstance,
    opts: { signerName?: string; signerCpf?: string; ip?: string; userAgent?: string; baseUrl?: string }
  ) {
    const contract = await FreelancerContract.findOne({ where: { freelancerId: freelancer.id } })
    if (!contract?.completedAt) throw new Error('Preencha todos os dados do perfil contratual antes de assinar.')
    if (!contract?.approvedAt) {
      throw new Error('O contrato só pode ser assinado depois que a agência revisar e aprovar o seu onboarding.')
    }

    const { template, renderedHtml, missing } = await renderActiveTemplate(freelancer)
    if (!template) throw new Error('A sua agência ainda não publicou um modelo de contrato.')
    if (missing.length) throw new Error(`Faltam dados para preencher o contrato: ${missing.join(', ')}.`)

    const signerName = String(opts.signerName || contract.fullName || freelancer.name).trim()
    const rawSignerCpf = String(opts.signerCpf || contract.cpf || '').trim()
    if (!signerName || !rawSignerCpf) throw new Error('Confirme o nome e o CPF do signatário.')
    const signerCpf = assertField(rawSignerCpf, 'O CPF do signatário', 'cpf', { required: true })

    const contentHash = sha256(renderedHtml)
    const existing = await FreelancerContractSignature.findOne({
      where: { freelancerId: freelancer.id, contentHash, status: 'signed' },
    })
    if (existing) return this.serialize(existing)

    const signature = await FreelancerContractSignature.create({
      freelancerId: freelancer.id,
      agencyId: freelancer.agencyId!,
      templateId: template.id,
      templateTitle: template.title,
      renderedHtml,
      contentHash,
      signerName,
      signerCpf,
      signerEmail: freelancer.email ?? null,
      acceptanceText: ACCEPTANCE_TEXT,
      signedAt: new Date(),
      ipAddress: opts.ip ?? null,
      userAgent: (opts.userAgent ?? '').slice(0, 255) || null,
    })

    const agency = await Agency.findByPk(freelancer.agencyId!)
    const verifyUrl = opts.baseUrl ? `${opts.baseUrl.replace(/\/$/, '')}/contratos/verificar/${signature.id}` : undefined
    await this.writeDocument(signature, agency, verifyUrl)

    return this.serialize(await signature.reload())
  },

  /** Gera o PDF e grava o caminho na assinatura. */
  async writeDocument(
    signature: any,
    agency: any,
    verifyUrl?: string
  ) {
    fs.mkdirSync(CONTRACTS_DIR, { recursive: true })
    const filename = `${signature.id}.pdf`
    const fullPath = path.join(CONTRACTS_DIR, filename)
    await new Promise<void>((resolve, reject) => {
      const stream = fs.createWriteStream(fullPath)
      const pdf = contractPdfService.buildContractPdf({
        renderedHtml: signature.renderedHtml,
        signature,
        agency,
        verifyUrl,
      })
      pdf.pipe(stream)
      stream.on('finish', () => resolve())
      stream.on('error', reject)
    })
    await signature.update({ documentPath: `contracts/${filename}` })
  },

  async listForAgency(agencyId: string) {
    const rows = await FreelancerContractSignature.findAll({
      where: { agencyId },
      order: [['signedAt', 'DESC']],
      include: [{ model: Freelancer, as: 'signatureFreelancer', attributes: ['id', 'name', 'email'] }],
    })
    return rows.map((r) => ({
      ...this.serialize(r),
      freelancer: (r as any).signatureFreelancer
        ? {
            id: (r as any).signatureFreelancer.id,
            name: (r as any).signatureFreelancer.name,
            email: (r as any).signatureFreelancer.email,
          }
        : null,
    }))
  },

  /** Assinatura vigente do colaborador (para baixar o PDF). */
  currentForFreelancer(freelancerId: string) {
    return FreelancerContractSignature.findOne({
      where: { freelancerId, status: 'signed' },
      order: [['signedAt', 'DESC']],
    })
  },

  async documentFor(scope: { agencyId?: string; freelancerId?: string }, signatureId: string) {
    const signature = await FreelancerContractSignature.findByPk(signatureId)
    if (!signature) throw new Error('Assinatura não encontrada.')
    if (scope.agencyId && signature.agencyId !== scope.agencyId) throw new Error('Assinatura não encontrada.')
    if (scope.freelancerId && signature.freelancerId !== scope.freelancerId) throw new Error('Assinatura não encontrada.')
    if (!signature.documentPath) {
      const agency = await Agency.findByPk(signature.agencyId)
      await this.writeDocument(signature, agency)
      await signature.reload()
    }
    const abs = path.resolve(__dirname, '..', '..', 'public', 'uploads', path.basename(signature.documentPath!))
    const inContracts = path.join(CONTRACTS_DIR, path.basename(signature.documentPath!))
    return { path: fs.existsSync(inContracts) ? inContracts : abs, filename: `contrato-${signature.id}.pdf` }
  },

  async verify(id: string) {
    const signature = await FreelancerContractSignature.findByPk(id, {
      include: [{ model: Agency, as: 'signatureAgency', attributes: ['name', 'legalName'] }],
    })
    if (!signature) throw new Error('Documento não encontrado.')
    const ag = (signature as any).signatureAgency
    return {
      id: signature.id,
      status: signature.status,
      agencyName: ag?.legalName || ag?.name || null,
      documentTitle: signature.templateTitle,
      signerFirstName: signature.signerName.split(' ')[0],
      signerCpfMasked: maskCpfForDisplay(signature.signerCpf),
      signedAt: signature.signedAt,
      contentHash: signature.contentHash,
    }
  },

  serialize(s: any) {
    return {
      id: s.id,
      templateId: s.templateId,
      templateTitle: s.templateTitle,
      contentHash: s.contentHash,
      signerName: s.signerName,
      signerCpf: s.signerCpf,
      signerEmail: s.signerEmail,
      signedAt: s.signedAt,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      status: s.status,
      hasDocument: !!s.documentPath,
    }
  },
}
