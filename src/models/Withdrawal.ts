// src/models/Withdrawal.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const WITHDRAWAL_STATUSES = ['requested', 'paid', 'rejected'] as const
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number]

export type BeneficiaryType = 'freelancer' | 'agency' | 'leader'

export const PIX_KEY_TYPES = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'] as const
export type PixKeyType = (typeof PIX_KEY_TYPES)[number]

export interface Withdrawal {
  id: string
  beneficiaryType: BeneficiaryType
  beneficiaryId: string
  amount: number
  status: WithdrawalStatus
  /** Chave Pix do beneficiário — o admin paga o saque por fora e dá baixa. */
  pixKey?: string | null
  pixKeyType?: PixKeyType | null
  requestedAt: Date
  processedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface WithdrawalCreationAttributes
  extends Optional<
    Withdrawal,
    'id' | 'status' | 'pixKey' | 'pixKeyType' | 'requestedAt' | 'processedAt' | 'createdAt' | 'updatedAt'
  > {}

export interface WithdrawalInstance extends Model<Withdrawal, WithdrawalCreationAttributes>, Withdrawal {}

export const Withdrawal = sequelize.define<WithdrawalInstance, Withdrawal>('Withdrawal', {
  id: {
    allowNull: false,
    primaryKey: true,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4
  },
  beneficiaryType: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [['freelancer', 'agency', 'leader']] }
  },
  beneficiaryId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: { min: 0.01 }
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'requested',
    validate: { isIn: [[...WITHDRAWAL_STATUSES]] }
  },
  pixKey: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pixKeyType: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isIn: [[...PIX_KEY_TYPES]] }
  },
  requestedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdAt: {
    allowNull: false,
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    allowNull: false,
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
})
