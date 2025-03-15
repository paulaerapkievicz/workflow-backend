// src/models/Invoice.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface Invoice {
  id: string
  supermarketId: string
  totalAmount: number
  status: 'pending' | 'paid' | 'canceled'
  createdAt: Date
  updatedAt: Date
}

export interface InvoiceCreationAttributes extends Optional<Invoice, 'id' | 'createdAt' | 'updatedAt'> {}

export interface InvoiceInstance extends Model<Invoice, InvoiceCreationAttributes>, Invoice {}

export const Invoice = sequelize.define<InvoiceInstance, Invoice>(
  'Invoice',
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    supermarketId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'supermarkets',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'canceled'),
      allowNull: false,
      defaultValue: 'pending'
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
  }
)
