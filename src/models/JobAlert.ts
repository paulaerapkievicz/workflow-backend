// src/models/JobAlert.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import {
  JOB_ALERT_TYPES,
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  ALERT_RESOLUTION_CODES,
  JobAlertType,
  AlertSeverity,
  AlertStatus,
  AlertAudience,
  AlertResolutionCode,
} from '../helpers/alerts'

export interface JobAlertContext {
  expectedAt?: string | null
  actualAt?: string | null
  minutesLate?: number | null
  minutesShort?: number | null
  minutesOver?: number | null
  breakMinutes?: number | null
  shiftPosition?: number | null
  workedMinutes?: number | null
  contractedMinutes?: number | null
  escalations?: { tier: AlertSeverity; at: string; note?: string }[]
  [key: string]: unknown
}

export interface JobAlert {
  id: string
  jobId: string
  jobShiftId?: string | null
  freelancerId?: string | null
  type: JobAlertType
  severity: AlertSeverity
  status: AlertStatus
  title: string
  message: string
  context: JobAlertContext
  /** Quem enxerga: subconjunto de ['agency','leader','supermarket']. Congelado na criação. */
  audience: AlertAudience[]
  /** `<jobId>:<jobShiftId|_>:<type>` — uma ocorrência viva por chave. */
  dedupeKey: string
  detectedAt: Date
  acknowledgedAt?: Date | null
  acknowledgedByUserId?: string | null
  resolvedAt?: Date | null
  resolvedBy?: 'system' | 'agency' | 'leader' | null
  resolvedByUserId?: string | null
  resolutionCode?: AlertResolutionCode | null
  resolutionNote?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface JobAlertCreationAttributes
  extends Optional<
    JobAlert,
    | 'id'
    | 'jobShiftId'
    | 'freelancerId'
    | 'severity'
    | 'status'
    | 'context'
    | 'audience'
    | 'detectedAt'
    | 'acknowledgedAt'
    | 'acknowledgedByUserId'
    | 'resolvedAt'
    | 'resolvedBy'
    | 'resolvedByUserId'
    | 'resolutionCode'
    | 'resolutionNote'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface JobAlertInstance extends Model<JobAlert, JobAlertCreationAttributes>, JobAlert {}

export const JobAlert = sequelize.define<JobAlertInstance, JobAlert>('JobAlert', {
  id: {
    allowNull: false,
    primaryKey: true,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'jobs', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  jobShiftId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'job_shifts', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  },
  freelancerId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'freelancers', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [[...JOB_ALERT_TYPES]] },
  },
  severity: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'warning',
    validate: { isIn: [[...ALERT_SEVERITIES]] },
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'open',
    validate: { isIn: [[...ALERT_STATUSES]] },
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  context: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  audience: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: ['agency', 'leader'],
  },
  dedupeKey: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  detectedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  acknowledgedByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolvedBy: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isIn: [['system', 'agency', 'leader']] },
  },
  resolvedByUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  },
  resolutionCode: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isIn: [[...ALERT_RESOLUTION_CODES]] },
  },
  resolutionNote: {
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
})
