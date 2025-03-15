// src/models/Freelancer.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { Agency } from './Agency'

export interface Freelancer {
  id: string
  agencyId: string
  name: string
  email: string
  phone?: string
  skills?: string
  createdAt: Date
  updatedAt: Date
}

export interface FreelancerCreationAttributes extends Optional<Freelancer, 'id' | 'phone' | 'skills' | 'createdAt' | 'updatedAt'> {}

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
    allowNull: false,
    references: {
      model: 'agencies',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
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
