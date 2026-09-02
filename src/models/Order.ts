// src/models/Order.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const ORDER_STATUSES = ['open', 'in_progress', 'completed', 'canceled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_APPROVAL_STATUSES = ['approved', 'pending_approval', 'rejected'] as const
export type OrderApprovalStatus = (typeof ORDER_APPROVAL_STATUSES)[number]

export interface Order {
  id: string
  supermarketId: string
  /** Filial "principal" do pedido (legado) — cada item carrega a própria filial. */
  branchId?: string | null
  status: OrderStatus
  approvalStatus: OrderApprovalStatus
  submittedByUserId?: string | null
  approvedByUserId?: string | null
  rejectionReason?: string | null
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface OrderCreationAttributes
  extends Optional<
    Order,
    | 'id'
    | 'branchId'
    | 'status'
    | 'approvalStatus'
    | 'submittedByUserId'
    | 'approvedByUserId'
    | 'rejectionReason'
    | 'notes'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface OrderInstance extends Model<Order, OrderCreationAttributes>, Order {}

export const Order = sequelize.define<OrderInstance, Order>(
  'Order',
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    supermarketId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'supermarkets', key: 'id' },
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
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'open',
      validate: { isIn: [[...ORDER_STATUSES]] },
    },
    approvalStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'approved',
      validate: { isIn: [[...ORDER_APPROVAL_STATUSES]] },
    },
    submittedByUserId: { type: DataTypes.UUID, allowNull: true },
    approvedByUserId: { type: DataTypes.UUID, allowNull: true },
    rejectionReason: { type: DataTypes.TEXT, allowNull: true },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'orders',
  }
)
