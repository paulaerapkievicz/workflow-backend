// src/models/JobShiftBreak.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const BREAK_STARTED_BY = ['freelancer', 'agency'] as const
export type BreakStartedBy = (typeof BREAK_STARTED_BY)[number]

/**
 * Pausa/intervalo dentro de um turno. Enquanto `endAt` é nulo a pausa está aberta.
 * O tempo de pausa (endAt − startAt) NÃO conta como hora trabalhada.
 */
export interface JobShiftBreak {
  id: string
  jobShiftId: string
  jobId: string
  freelancerId: string
  startAt: Date
  endAt?: Date | null
  startedBy: BreakStartedBy
  createdAt: Date
  updatedAt: Date
}

export interface JobShiftBreakCreationAttributes
  extends Optional<
    JobShiftBreak,
    'id' | 'endAt' | 'startedBy' | 'createdAt' | 'updatedAt'
  > {}

export interface JobShiftBreakInstance
  extends Model<JobShiftBreak, JobShiftBreakCreationAttributes>,
    JobShiftBreak {}

export const JobShiftBreak = sequelize.define<JobShiftBreakInstance, JobShiftBreak>('JobShiftBreak', {
  id: {
    allowNull: false,
    primaryKey: true,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
  },
  jobShiftId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'job_shifts', key: 'id' },
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
    allowNull: false,
    references: { model: 'freelancers', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  startAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  startedBy: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'freelancer',
    validate: { isIn: [[...BREAK_STARTED_BY]] },
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
