// src/models/Payment.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface Payment {
  id: string
  jobId: string
  freelancerId: string
  amount: number
  status: 'pending' | 'paid' | 'canceled'
  createdAt: Date
  updatedAt: Date
}

export interface PaymentCreationAttributes extends Optional<Payment, 'id'> {}

export interface PaymentInstance extends Model<Payment, PaymentCreationAttributes>, Payment {}

export const Payment = sequelize.define<PaymentInstance, Payment>(
  'Payment',
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'jobs',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    freelancerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'freelancers',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    amount: {
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
