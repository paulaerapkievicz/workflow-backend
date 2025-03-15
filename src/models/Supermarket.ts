// src/models/Supermarket.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { User } from './User'

export interface Supermarket {
  id: string
  ownerId: string
  name: string
  cnpj: string
  address: string
  phone?: string
  createdAt: Date
  updatedAt: Date
}

export interface SupermarketCreationAttributes extends Optional<Supermarket, 'id' | 'phone'> {}

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
