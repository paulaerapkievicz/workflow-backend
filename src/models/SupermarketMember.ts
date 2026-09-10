// src/models/SupermarketMember.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface SupermarketMember {
  id: string
  supermarketId: string
  userId: string
  canSubmitOrders: boolean
  canApproveOrders: boolean
  /** Vê as faturas (fechamento mensal) da rede. O dono sempre pode; gerentes só quando marcado. */
  canViewInvoices: boolean
  /** Além de ver, paga a fatura e lança/remove contestação. Exige (na prática) `canViewInvoices`. */
  canPayInvoices: boolean
  /** Cargo configurável na equipe (`team_roles`, scope 'supermarket'). NULL = sem cargo. */
  teamRoleId?: string | null
  isOwner: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SupermarketMemberCreationAttributes
  extends Optional<
    SupermarketMember,
    | 'id'
    | 'canSubmitOrders'
    | 'canApproveOrders'
    | 'canViewInvoices'
    | 'canPayInvoices'
    | 'teamRoleId'
    | 'isOwner'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface SupermarketMemberInstance
  extends Model<SupermarketMember, SupermarketMemberCreationAttributes>,
    SupermarketMember {}

export const SupermarketMember = sequelize.define<SupermarketMemberInstance, SupermarketMember>(
  'SupermarketMember',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    supermarketId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'supermarkets', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    canSubmitOrders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    canApproveOrders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    canViewInvoices: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    canPayInvoices: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    teamRoleId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'team_roles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    isOwner: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'supermarket_members' }
)
