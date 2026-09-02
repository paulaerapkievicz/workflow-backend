// src/models/Agency.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { User } from './User'

export interface Agency {
  id: string
  ownerId: string
  name: string
  cnpj: string
  address: string
  phone?: string
  availableBalance: number
  commissionPercentage: number
  checkinRadius: number
  cancellationWindowMinutes: number
  requireCheckoutPhoto: boolean
  reviewEnabled: boolean
  onboardingRequired: boolean
  uniformPrice: number
  allowSelfRegistration: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AgencyCreationAttributes
  extends Optional<
    Agency,
    | 'id'
    | 'phone'
    | 'availableBalance'
    | 'commissionPercentage'
    | 'checkinRadius'
    | 'cancellationWindowMinutes'
    | 'requireCheckoutPhoto'
    | 'reviewEnabled'
    | 'onboardingRequired'
    | 'uniformPrice'
    | 'allowSelfRegistration'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface AgencyInstance extends Model<Agency, AgencyCreationAttributes>, Agency {}

export const Agency = sequelize.define<AgencyInstance, Agency>('Agency', {
  id: {
    allowNull: false,
    primaryKey: true,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  cnpj: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING
  },
  availableBalance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  commissionPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 10
  },
  checkinRadius: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 300
  },
  cancellationWindowMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30
  },
  requireCheckoutPhoto: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  reviewEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  onboardingRequired: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  uniformPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  allowSelfRegistration: {
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
})

// Associação com User (Owner da Agência)
Agency.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' })
