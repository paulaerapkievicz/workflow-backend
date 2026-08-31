// src/models/JobLog.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const JOB_LOG_EVENTS = ['check-in', 'check-out', 'break-start', 'break-end', 'no-show'] as const;
export type EventType = (typeof JOB_LOG_EVENTS)[number];

export interface JobLog {
  id: string
  jobId: string
  freelancerId: string
  jobShiftId?: string | null
  eventType: EventType;
  reason?: string | null
  latitude?: number | null
  longitude?: number | null
  accuracy?: number | null
  timestamp: Date
  createdAt: Date
  updatedAt: Date
}

export interface JobLogCreationAttributes
  extends Optional<
    JobLog,
    | 'id'
    | 'jobShiftId'
    | 'reason'
    | 'latitude'
    | 'longitude'
    | 'accuracy'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface JobLogInstance extends Model<JobLog, JobLogCreationAttributes>, JobLog {}

export const JobLog = sequelize.define<JobLogInstance, JobLog>(
  'JobLog',
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
    jobShiftId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'job_shifts',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    eventType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [[...JOB_LOG_EVENTS]]
      }
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: true
    },
    accuracy: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      // defaultValue: DataTypes.NOW
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
  },
  {
    timestamps: true // Garante createdAt e updatedAt automaticamente
  }
)
