// src/models/Freelancer.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { Agency } from './Agency'

export const PROFILE_PHOTO_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const
export type ProfilePhotoStatus = (typeof PROFILE_PHOTO_STATUSES)[number]

export interface Freelancer {
  id: string
  agencyId: string | null
  userId?: string | null
  name: string
  email: string
  phone?: string
  document?: string | null
  profilePhotoUrl?: string | null
  /** Estado da foto de perfil enviada no onboarding — 'approved' direto quando a agência não exige revisão. */
  profilePhotoStatus: ProfilePhotoStatus
  profilePhotoRejectionReason?: string | null
  profilePhotoSubmittedAt?: Date | null
  profilePhotoReviewedAt?: Date | null
  skills?: string
  registrationStatus: 'pending' | 'approved' | 'rejected'
  availableBalance: number
  blockedUntil?: Date | null
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
    | 'document'
    | 'profilePhotoUrl'
    | 'profilePhotoStatus'
    | 'profilePhotoRejectionReason'
    | 'profilePhotoSubmittedAt'
    | 'profilePhotoReviewedAt'
    | 'skills'
    | 'registrationStatus'
    | 'availableBalance'
    | 'blockedUntil'
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
    unique: true,
    validate: { isEmail: { msg: 'E-mail inválido.' } }
  },
  phone: {
    type: DataTypes.STRING
  },
  document: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profilePhotoUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profilePhotoStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'none',
    validate: { isIn: [[...PROFILE_PHOTO_STATUSES]] }
  },
  profilePhotoRejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  profilePhotoSubmittedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  profilePhotoReviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  skills: {
    type: DataTypes.TEXT
  },
  registrationStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'approved',
    validate: { isIn: [['pending', 'approved', 'rejected']] }
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
