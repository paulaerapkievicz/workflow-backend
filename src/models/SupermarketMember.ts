// src/models/SupermarketMember.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface SupermarketMember {
  id: string
  supermarketId: string
  userId: string
  /** NULL = acesso à rede toda; preenchido = gerente de uma loja. */
  branchId?: string | null
  canSubmitOrders: boolean
  canApproveOrders: boolean
  isOwner: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SupermarketMemberCreationAttributes
  extends Optional<
    SupermarketMember,
    | 'id'
    | 'branchId'
    | 'canSubmitOrders'
    | 'canApproveOrders'
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
    branchId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    canSubmitOrders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    canApproveOrders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isOwner: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'supermarket_members' }
)
