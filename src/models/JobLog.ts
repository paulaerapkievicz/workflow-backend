// src/models/JobLog.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

const EventTypeEnum = ['check-in', 'check-out', 'break-start', 'break-end'] as const;
type EventType = (typeof EventTypeEnum)[number];

export interface JobLog {
  id: string
  jobId: string
  freelancerId: string
  eventType: EventType;
  timestamp: Date
  createdAt: Date
  updatedAt: Date
}

export interface JobLogCreationAttributes extends Optional<JobLog, 'id'> {}

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
    eventType: {
      type: DataTypes.ENUM('check-in', 'check-out', 'break-start', 'break-end'),
      allowNull: false
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
