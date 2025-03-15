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
  createdAt: Date
  updatedAt: Date
}

export interface BranchCreationAttributes extends Optional<Branch, 'id' | 'phone'> {}

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
 