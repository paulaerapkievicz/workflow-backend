// src/models/Job.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface Job {
  id: string
  supermarketId: string
  branchId: string
  categoryId: string
  freelancerId?: string | null
  status: 'pending' | 'accepted' | 'completed' | 'canceled'
  startTime: Date
  endTime: Date
  paymentAmount: number
  createdAt: Date
  updatedAt: Date
}

export interface JobCreationAttributes extends Optional<Job, 'id' | 'freelancerId'> {}

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
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'completed', 'canceled'),
      allowNull: false,
      defaultValue: 'pending'
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
      allowNull: false
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
