// src/models/Invite.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { Agency } from './Agency'

export interface Invite {
  id: string
  agencyId: string
  role: 'supermarket' | 'freelancer' | 'leader'
  token: string
  status: 'pending' | 'used' | 'revoked'
  expiresAt?: Date | null
  usedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface InviteCreationAttributes
  extends Optional<Invite, 'id' | 'status' | 'expiresAt' | 'usedAt' | 'createdAt' | 'updatedAt'> {}

export interface InviteInstance extends Model<Invite, InviteCreationAttributes>, Invite {}

export const Invite = sequelize.define<InviteInstance, Invite>('Invite', {
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
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [['supermarket', 'freelancer', 'leader']] }
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    validate: { isIn: [['pending', 'used', 'revoked']] }
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  usedAt: {
    type: DataTypes.DATE,
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

Invite.belongsTo(Agency, { foreignKey: 'agencyId', as: 'inviteAgency' })
