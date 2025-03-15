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
  createdAt: Date
  updatedAt: Date
}

export interface AgencyCreationAttributes extends Optional<Agency, 'id' | 'phone'> {}

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
