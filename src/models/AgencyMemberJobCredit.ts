// src/models/AgencyMemberJobCredit.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const AGENCY_MEMBER_JOB_CREDIT_STATUSES = ['released', 'pending', 'canceled'] as const
export type AgencyMemberJobCreditStatus = (typeof AGENCY_MEMBER_JOB_CREDIT_STATUSES)[number]

/**
 * Crédito automático de um líder pago `por_colaborador`: toda vaga concluída por um
 * colaborador do escopo do líder rende `amount` (snapshot do `agency_members.pay_amount`
 * no momento da liquidação).
 *
 * - `released`: a carteira do líder já foi creditada e o saldo da agência debitado.
 * - `pending`: o crédito foi registrado mas a agência ainda decide se paga — usado quando
 *   a conclusão veio de um caminho problemático (desistência, falta, troca, checkout
 *   forçado). A agência libera ou cancela em Pagamentos.
 * - `canceled`: a agência decidiu não pagar (se estava `released`, o valor é estornado).
 */
export interface AgencyMemberJobCredit {
  id: string
  agencyMemberId: string
  jobId: string
  freelancerId?: string | null
  amount: number
  status: AgencyMemberJobCreditStatus
  note?: string | null
  releasedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface AgencyMemberJobCreditCreationAttributes
  extends Optional<
    AgencyMemberJobCredit,
    'id' | 'freelancerId' | 'status' | 'note' | 'releasedAt' | 'createdAt' | 'updatedAt'
  > {}

export interface AgencyMemberJobCreditInstance
  extends Model<AgencyMemberJobCredit, AgencyMemberJobCreditCreationAttributes>,
    AgencyMemberJobCredit {}

export const AgencyMemberJobCredit = sequelize.define<
  AgencyMemberJobCreditInstance,
  AgencyMemberJobCredit
>(
  'AgencyMemberJobCredit',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agencyMemberId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'agency_members', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'jobs', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    freelancerId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'freelancers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, validate: { min: 0.01 } },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'released',
      validate: { isIn: [[...AGENCY_MEMBER_JOB_CREDIT_STATUSES]] },
    },
    note: { type: DataTypes.STRING, allowNull: true },
    releasedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'agency_member_job_credits' }
)
