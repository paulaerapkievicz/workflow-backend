// src/models/Commission.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface Commission {
  id: string
  agencyId: string
  percentage: number
  createdAt: Date
  updatedAt: Date
}

export interface CommissionCreationAttributes extends Optional<Commission, 'id'> {}

export interface CommissionInstance extends Model<Commission, CommissionCreationAttributes>, Commission {}

export const Commission = sequelize.define<CommissionInstance, Commission>(
  'Commission',
  {
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
    percentage: {
      type: DataTypes.DECIMAL(5, 2),
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
  }
)
