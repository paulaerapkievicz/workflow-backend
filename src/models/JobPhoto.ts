// src/models/JobPhoto.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface JobPhoto {
  id: string
  jobId: string
  freelancerId: string
  jobLogId?: string | null
  url: string
  caption?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface JobPhotoCreationAttributes
  extends Optional<JobPhoto, 'id' | 'jobLogId' | 'caption' | 'createdAt' | 'updatedAt'> {}

export interface JobPhotoInstance extends Model<JobPhoto, JobPhotoCreationAttributes>, JobPhoto {}

export const JobPhoto = sequelize.define<JobPhotoInstance, JobPhoto>('JobPhoto', {
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
  freelancerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'freelancers', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  jobLogId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'job_logs', key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  caption: {
    type: DataTypes.STRING,
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
