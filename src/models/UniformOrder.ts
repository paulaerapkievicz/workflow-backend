// src/models/UniformOrder.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const UNIFORM_ORDER_STATUSES = [
  'pending_payment',
  'paid',
  'shipped',
  'delivered',
  'photo_submitted',
  'approved',
  'rejected',
] as const
export type UniformOrderStatus = (typeof UNIFORM_ORDER_STATUSES)[number]

export const SHIRT_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XGG'] as const

export interface UniformOrder {
  id: string
  freelancerId: string
  shirtSize: string
  amount: number
  status: UniformOrderStatus
  paymentProvider?: string | null
  paymentRef?: string | null
  paymentUrl?: string | null
  shippingAddress?: Record<string, unknown> | null
  trackingCode?: string | null
  selfiePhotoUrl?: string | null
  rejectionReason?: string | null
  paidAt?: Date | null
  shippedAt?: Date | null
  deliveredAt?: Date | null
  reviewedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface UniformOrderCreationAttributes
  extends Optional<
    UniformOrder,
    | 'id'
    | 'amount'
    | 'status'
    | 'paymentProvider'
    | 'paymentRef'
    | 'paymentUrl'
    | 'shippingAddress'
    | 'trackingCode'
    | 'selfiePhotoUrl'
    | 'rejectionReason'
    | 'paidAt'
    | 'shippedAt'
    | 'deliveredAt'
    | 'reviewedAt'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface UniformOrderInstance
  extends Model<UniformOrder, UniformOrderCreationAttributes>,
    UniformOrder {}

export const UniformOrder = sequelize.define<UniformOrderInstance, UniformOrder>(
  'UniformOrder',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    freelancerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'freelancers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    shirtSize: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending_payment',
      validate: { isIn: [[...UNIFORM_ORDER_STATUSES]] },
    },
    paymentProvider: { type: DataTypes.STRING, allowNull: true },
    paymentRef: { type: DataTypes.STRING, allowNull: true },
    paymentUrl: { type: DataTypes.TEXT, allowNull: true },
    shippingAddress: { type: DataTypes.JSONB, allowNull: true },
    trackingCode: { type: DataTypes.STRING, allowNull: true },
    selfiePhotoUrl: { type: DataTypes.STRING, allowNull: true },
    rejectionReason: { type: DataTypes.TEXT, allowNull: true },
    paidAt: { type: DataTypes.DATE, allowNull: true },
    shippedAt: { type: DataTypes.DATE, allowNull: true },
    deliveredAt: { type: DataTypes.DATE, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'uniform_orders' }
)
