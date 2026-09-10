// src/models/Branch.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { Supermarket } from './Supermarket'

export interface Branch {
  id: string
  supermarketId: string
  name: string
  address: string
  phone?: string
  legalName?: string | null
  cnpj?: string | null
  email?: string | null
  logoUrl?: string | null
  profilePhotoUrl?: string | null
  latitude?: number | null
  longitude?: number | null
  geocodedAt?: Date | null
  geocodeQuery?: string | null
  serviceStatus: 'approved' | 'pending'
  approvedAt?: Date | null
  approvedBy?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface BranchCreationAttributes
  extends Optional<
    Branch,
    | 'id'
    | 'phone'
    | 'legalName'
    | 'cnpj'
    | 'email'
    | 'logoUrl'
    | 'profilePhotoUrl'
    | 'latitude'
    | 'longitude'
    | 'geocodedAt'
    | 'geocodeQuery'
    | 'serviceStatus'
    | 'approvedAt'
    | 'approvedBy'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface BranchInstance extends Model<Branch, BranchCreationAttributes>, Branch {}

export const Branch = sequelize.define<BranchInstance, Branch>('Branch', {
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
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING
  },
  legalName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cnpj: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  logoUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profilePhotoUrl: {
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
  geocodedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  geocodeQuery: {
    type: DataTypes.STRING,
    allowNull: true
  },
  serviceStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'approved',
    validate: { isIn: [['approved', 'pending']] }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
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

// Associação com Supermarket
Branch.belongsTo(Supermarket, { foreignKey: 'supermarketId', as: 'supermarket' })
 