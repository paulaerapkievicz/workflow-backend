// src/models/AgencyMemberPayment.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

/**
 * Crédito lançado pela agência (dono) na carteira de um líder — debita o saldo da agência
 * e credita `agency_members.available_balance`. Para `payType = 'mensal'` guarda o
 * `referenceMonth` ('YYYY-MM') para não pagar o mesmo mês duas vezes.
 */
export interface AgencyMemberPayment {
  id: string
  agencyMemberId: string
  amount: number
  referenceMonth?: string | null
  note?: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface AgencyMemberPaymentCreationAttributes
  extends Optional<
    AgencyMemberPayment,
    'id' | 'referenceMonth' | 'note' | 'createdAt' | 'updatedAt'
  > {}

export interface AgencyMemberPaymentInstance
  extends Model<AgencyMemberPayment, AgencyMemberPaymentCreationAttributes>,
    AgencyMemberPayment {}

export const AgencyMemberPayment = sequelize.define<
  AgencyMemberPaymentInstance,
  AgencyMemberPayment
>(
  'AgencyMemberPayment',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agencyMemberId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'agency_members', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, validate: { min: 0.01 } },
    referenceMonth: { type: DataTypes.STRING, allowNull: true },
    note: { type: DataTypes.STRING, allowNull: true },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'agency_member_payments' }
)
