// src/models/Invite.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { Agency } from './Agency'

export interface Invite {
  id: string
  agencyId: string
  role: 'supermarket' | 'freelancer' | 'leader' | 'partner'
  token: string
  status: 'pending' | 'used' | 'revoked'
  /** Só para convite de líder: o pagamento dele, copiado para o AgencyMember no resgate. */
  payType?: 'hora' | 'diaria' | 'mensal' | 'por_colaborador' | null
  payAmount?: number | null
  expiresAt?: Date | null
  usedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface InviteCreationAttributes
  extends Optional<
    Invite,
    'id' | 'status' | 'payType' | 'payAmount' | 'expiresAt' | 'usedAt' | 'createdAt' | 'updatedAt'
  > {}

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
    validate: { isIn: [['supermarket', 'freelancer', 'leader', 'partner']] }
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
  payType: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: { isIn: [['hora', 'diaria', 'mensal', 'por_colaborador']] }
  },
  payAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
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
