// src/models/Order.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const ORDER_STATUSES = ['open', 'in_progress', 'completed', 'canceled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export interface Order {
  id: string
  supermarketId: string
  branchId: string
  status: OrderStatus
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface OrderCreationAttributes
  extends Optional<Order, 'id' | 'status' | 'notes' | 'createdAt' | 'updatedAt'> {}

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
      allowNull: false,
      references: { model: 'branches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'open',
      validate: { isIn: [[...ORDER_STATUSES]] },
    },
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
