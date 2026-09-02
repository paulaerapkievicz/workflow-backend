// src/models/Invoice.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const INVOICE_TYPES = ['job', 'monthly'] as const
export type InvoiceType = (typeof INVOICE_TYPES)[number]

export interface Invoice {
  id: string
  supermarketId: string
  agencyId?: string | null
  branchId?: string | null
  jobId?: string | null
  paymentId?: string | null
  type: InvoiceType
  referenceMonth?: string | null
  periodStart?: Date | null
  periodEnd?: Date | null
  totalJobs?: number | null
  contractedMinutes?: number | null
  workedMinutes?: number | null
  totalAmount: number
  status: 'pending' | 'paid' | 'canceled'
  createdAt: Date
  updatedAt: Date
}

export interface InvoiceCreationAttributes
  extends Optional<
    Invoice,
    | 'id'
    | 'agencyId'
    | 'branchId'
    | 'jobId'
    | 'paymentId'
    | 'type'
    | 'referenceMonth'
    | 'periodStart'
    | 'periodEnd'
    | 'totalJobs'
    | 'contractedMinutes'
    | 'workedMinutes'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface InvoiceInstance extends Model<Invoice, InvoiceCreationAttributes>, Invoice {}

export const Invoice = sequelize.define<InvoiceInstance, Invoice>(
  'Invoice',
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    supermarketId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'supermarkets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'agencies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    branchId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'jobs', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'job',
      validate: { isIn: [[...INVOICE_TYPES]] }
    },
    referenceMonth: {
      type: DataTypes.STRING,
      allowNull: true
    },
    periodStart: {
      type: DataTypes.DATE,
      allowNull: true
    },
    periodEnd: {
      type: DataTypes.DATE,
      allowNull: true
    },
    totalJobs: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    contractedMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    workedMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'payments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'canceled'),
      allowNull: false,
      defaultValue: 'pending'
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
  }
)
