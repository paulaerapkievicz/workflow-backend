// src/models/Supermarket.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { User } from './User'
import { Agency } from './Agency'

export interface Supermarket {
  id: string
  ownerId: string
  agencyId: string
  name: string
  legalName?: string | null
  cnpj: string
  address: string
  phone?: string
  email?: string | null
  logoUrl?: string | null
  profilePhotoUrl?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SupermarketCreationAttributes
  extends Optional<
    Supermarket,
    'id' | 'legalName' | 'phone' | 'email' | 'logoUrl' | 'profilePhotoUrl' | 'createdAt' | 'updatedAt'
  > {}

export interface SupermarketInstance
  extends Model<Supermarket, SupermarketCreationAttributes>,
    Supermarket {}

export const Supermarket = sequelize.define<SupermarketInstance, Supermarket>('Supermarket', {
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
  agencyId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'agencies',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  legalName: {
    type: DataTypes.STRING,
    allowNull: true
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

// Adicionamos a associação no index.ts
Supermarket.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' })
Supermarket.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' })
