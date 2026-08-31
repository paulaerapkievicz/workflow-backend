// src/models/Payment.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const PAYMENT_STATUSES = ['settled', 'canceled'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export interface Payment {
  id: string
  jobId: string
  freelancerId: string
  amount: number
  grossAmount: number
  agencyAmount: number
  freelancerAmount: number
  status: PaymentStatus
  paidAt?: Date | null
  releasedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface PaymentCreationAttributes
  extends Optional<
    Payment,
    | 'id'
    | 'status'
    | 'paidAt'
    | 'releasedAt'
    | 'grossAmount'
    | 'agencyAmount'
    | 'freelancerAmount'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface PaymentInstance extends Model<Payment, PaymentCreationAttributes>, Payment {}

export const Payment = sequelize.define<PaymentInstance, Payment>(
  'Payment',
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'jobs',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    freelancerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'freelancers',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    grossAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    agencyAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    freelancerAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'settled',
      validate: {
        isIn: [[...PAYMENT_STATUSES]]
      }
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    releasedAt: {
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
  }
)
