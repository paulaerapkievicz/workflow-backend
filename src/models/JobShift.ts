// src/models/JobShift.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const JOB_SHIFT_STATUSES = ['pending', 'in_progress', 'done', 'missed'] as const
export type JobShiftStatus = (typeof JOB_SHIFT_STATUSES)[number]

export interface JobShift {
  id: string
  jobId: string
  position: number
  startTime: Date
  endTime: Date
  label?: string | null
  /** Período nominal (manha|tarde|noite|madrugada) — só rótulo/filtro, não limita o horário. */
  nominalPeriod?: string | null
  /** Intervalo (min) não remunerado desse turno — descontado das horas contratadas. */
  breakMinutes: number
  status: JobShiftStatus
  checkInAt?: Date | null
  checkOutAt?: Date | null
  workedMinutes?: number | null
  createdAt: Date
  updatedAt: Date
}

export interface JobShiftCreationAttributes
  extends Optional<
    JobShift,
    | 'id'
    | 'position'
    | 'label'
    | 'nominalPeriod'
    | 'breakMinutes'
    | 'status'
    | 'checkInAt'
    | 'checkOutAt'
    | 'workedMinutes'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface JobShiftInstance extends Model<JobShift, JobShiftCreationAttributes>, JobShift {}

export const JobShift = sequelize.define<JobShiftInstance, JobShift>('JobShift', {
  id: {
    allowNull: false,
    primaryKey: true,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'jobs', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  label: {
    type: DataTypes.STRING,
    allowNull: true
  },
  nominalPeriod: {
    type: DataTypes.STRING,
    allowNull: true
  },
  breakMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    validate: { isIn: [[...JOB_SHIFT_STATUSES]] }
  },
  checkInAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  checkOutAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  workedMinutes: {
    type: DataTypes.INTEGER,
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
