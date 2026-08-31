// src/models/Job.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const JOB_STATUSES = [
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'canceled',
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export interface Job {
  id: string
  supermarketId: string
  branchId: string
  categoryId: string
  freelancerId?: string | null
  orderId?: string | null
  orderItemId?: string | null
  monthlyInvoiceId?: string | null
  title: string
  description?: string | null
  status: JobStatus
  startTime: Date
  endTime: Date
  paymentAmount?: number | null
  grossAmount?: number | null
  contractedMinutes?: number | null
  workedMinutes?: number | null
  completedAt?: Date | null
  photosRequired: boolean
  agencyReviewEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface JobCreationAttributes
  extends Optional<
    Job,
    | 'id'
    | 'freelancerId'
    | 'orderId'
    | 'orderItemId'
    | 'monthlyInvoiceId'
    | 'description'
    | 'status'
    | 'paymentAmount'
    | 'grossAmount'
    | 'contractedMinutes'
    | 'workedMinutes'
    | 'completedAt'
    | 'photosRequired'
    | 'agencyReviewEnabled'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface JobInstance extends Model<Job, JobCreationAttributes>, Job {}

export const Job = sequelize.define<JobInstance, Job>(
  'Job',
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
    branchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'branches',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    freelancerId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'freelancers',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'orders', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    orderItemId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'order_items', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    monthlyInvoiceId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'invoices', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      validate: {
        isIn: [[...JOB_STATUSES]]
      }
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    paymentAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    grossAmount: {
      type: DataTypes.DECIMAL(10, 2),
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
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    photosRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    agencyReviewEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
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
