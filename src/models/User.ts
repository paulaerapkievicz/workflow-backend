// src/models/User.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface User {
  id: string
  name: string
  email: string
  passwordHash: string
  role: 'admin' | 'supermarket' | 'freelancer' | 'agency' | 'leader'
  phone?: string | null
  birthDate?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface UserCreationAttributes
  extends Optional<User, 'id' | 'phone' | 'birthDate' | 'createdAt' | 'updatedAt'> {}

export interface UserInstance extends Model<User, UserCreationAttributes>, User {}

export const User = sequelize.define<UserInstance, User>('User', {
  id: {
    allowNull: false,
    primaryKey: true,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4
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
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Coluna convertida de ENUM para VARCHAR (migration 20260909010000) para caber o papel 'leader'
  // sem recriar o tipo a cada valor novo — mesmo padrão de jobs.status / job_logs.event_type.
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [['admin', 'supermarket', 'freelancer', 'agency', 'leader']] }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  birthDate: {
    type: DataTypes.DATEONLY,
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
