// src/models/User.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface User {
  id: string
  name: string
  email: string
  passwordHash: string
  role: 'admin' | 'supermarket' | 'freelancer' | 'agency'
  createdAt: Date
  updatedAt: Date
}

export interface UserCreationAttributes extends Optional<User, 'id' | 'createdAt' | 'updatedAt'> {}

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
  role: {
    type: DataTypes.ENUM('admin', 'supermarket', 'freelancer', 'agency'),
    allowNull: false
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
