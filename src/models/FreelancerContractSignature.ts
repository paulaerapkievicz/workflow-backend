// src/models/FreelancerContractSignature.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

/**
 * Assinatura eletrônica do contrato pelo colaborador. Registro imutável — uma nova assinatura
 * (modelo alterado, por exemplo) cria outra linha e preserva o histórico.
 *
 * Trilha de evidências para validade legal (MP 2.200-2/2001, Art. 10 §2º):
 * - `renderedHtml` / `contentHash` (sha256): integridade do documento assinado;
 * - `signerName` / `signerCpf` / usuário autenticado: autoria;
 * - `signedAt` (hora do servidor), `ipAddress`, `userAgent`, `acceptanceText`: consentimento.
 */
export interface FreelancerContractSignature {
  id: string
  freelancerId: string
  agencyId: string
  templateId?: string | null
  templateTitle: string
  renderedHtml: string
  contentHash: string
  documentPath?: string | null
  signerName: string
  signerCpf: string
  signerEmail?: string | null
  acceptanceText: string
  signedAt: Date
  ipAddress?: string | null
  userAgent?: string | null
  status: 'signed' | 'revoked'
  revokedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FreelancerContractSignatureCreationAttributes
  extends Optional<
    FreelancerContractSignature,
    | 'id'
    | 'templateId'
    | 'documentPath'
    | 'signerEmail'
    | 'signedAt'
    | 'ipAddress'
    | 'userAgent'
    | 'status'
    | 'revokedAt'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface FreelancerContractSignatureInstance
  extends Model<FreelancerContractSignature, FreelancerContractSignatureCreationAttributes>,
    FreelancerContractSignature {}

export const FreelancerContractSignature = sequelize.define<
  FreelancerContractSignatureInstance,
  FreelancerContractSignature
>(
  'FreelancerContractSignature',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    freelancerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'freelancers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'agencies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'contract_templates', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    templateTitle: { type: DataTypes.STRING, allowNull: false },
    renderedHtml: { type: DataTypes.TEXT, allowNull: false },
    contentHash: { type: DataTypes.STRING(64), allowNull: false },
    documentPath: { type: DataTypes.STRING, allowNull: true },
    signerName: { type: DataTypes.STRING, allowNull: false },
    signerCpf: { type: DataTypes.STRING, allowNull: false },
    signerEmail: { type: DataTypes.STRING, allowNull: true },
    acceptanceText: { type: DataTypes.TEXT, allowNull: false },
    signedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    ipAddress: { type: DataTypes.STRING, allowNull: true },
    userAgent: { type: DataTypes.STRING, allowNull: true },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'signed',
      validate: { isIn: [['signed', 'revoked']] },
    },
    revokedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'freelancer_contract_signatures' }
)
