// src/models/InvoiceAdjustment.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const INVOICE_ADJUSTMENT_STATUSES = ['pending', 'approved', 'rejected'] as const
export type InvoiceAdjustmentStatus = (typeof INVOICE_ADJUSTMENT_STATUSES)[number]

export interface InvoiceAdjustment {
  id: string
  invoiceId: string
  description: string
  amount: number
  status: InvoiceAdjustmentStatus
  createdBy?: string | null
  resolvedBy?: string | null
  resolvedAt?: Date | null
  agencyNote?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface InvoiceAdjustmentCreationAttributes
  extends Optional<
    InvoiceAdjustment,
    | 'id'
    | 'status'
    | 'createdBy'
    | 'resolvedBy'
    | 'resolvedAt'
    | 'agencyNote'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface InvoiceAdjustmentInstance
  extends Model<InvoiceAdjustment, InvoiceAdjustmentCreationAttributes>,
    InvoiceAdjustment {}

export const InvoiceAdjustment = sequelize.define<InvoiceAdjustmentInstance, InvoiceAdjustment>(
  'InvoiceAdjustment',
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    invoiceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'invoices', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [[...INVOICE_ADJUSTMENT_STATUSES]] },
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    resolvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    agencyNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }
)
