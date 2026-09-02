// src/models/Freelancer.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { Agency } from './Agency'

export interface Freelancer {
  id: string
  agencyId: string | null
  userId?: string | null
  name: string
  email: string
  phone?: string
  skills?: string
  availableBalance: number
  blockedUntil?: Date | null
  onboardingApprovedAt?: Date | null
  ratingAvg?: number | null
  ratingCount: number
  createdAt: Date
  updatedAt: Date
}

export interface FreelancerCreationAttributes
  extends Optional<
    Freelancer,
    | 'id'
    | 'agencyId'
    | 'userId'
    | 'phone'
    | 'skills'
    | 'availableBalance'
    | 'blockedUntil'
    | 'onboardingApprovedAt'
    | 'ratingAvg'
    | 'ratingCount'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface FreelancerInstance extends Model<Freelancer, FreelancerCreationAttributes>, Freelancer {}

export const Freelancer = sequelize.define<FreelancerInstance, Freelancer>('Freelancer', {
  id: {
    allowNull: false,
    primaryKey: true,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4
  },
  agencyId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'agencies',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  phone: {
    type: DataTypes.STRING
  },
  skills: {
    type: DataTypes.TEXT
  },
  availableBalance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  blockedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  onboardingApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ratingAvg: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true
  },
  ratingCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
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

// Associação com Agency (Freelancer pertence a uma agência)
Freelancer.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' })
