// src/models/OrderItem.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface OrderItemShiftTemplate {
  shiftPeriod?: string | null
  startTime: string
  endTime: string
  label?: string | null
}

export interface OrderItem {
  id: string
  orderId: string
  categoryId: string
  branchId?: string | null
  title: string
  description?: string | null
  quantity: number
  shiftPeriod?: string | null
  photosRequired: boolean
  agencyReviewEnabled: boolean
  shifts: OrderItemShiftTemplate[]
  createdAt: Date
  updatedAt: Date
}

export interface OrderItemCreationAttributes
  extends Optional<
    OrderItem,
    | 'id'
    | 'branchId'
    | 'description'
    | 'quantity'
    | 'shiftPeriod'
    | 'photosRequired'
    | 'agencyReviewEnabled'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface OrderItemInstance extends Model<OrderItem, OrderItemCreationAttributes>, OrderItem {}

export const OrderItem = sequelize.define<OrderItemInstance, OrderItem>(
  'OrderItem',
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'orders', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'categories', key: 'id' },
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
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    shiftPeriod: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    photosRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    agencyReviewEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    shifts: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
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
    tableName: 'order_items',
  }
)
