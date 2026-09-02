// src/models/AgencyCategoryRate.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface AgencyCategoryRate {
  id: string
  agencyId: string
  categoryId: string
  /** Filial específica; NULL = valor padrão da rede para essa função. */
  branchId?: string | null
  hourlyRate: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AgencyCategoryRateCreationAttributes
  extends Optional<AgencyCategoryRate, 'id' | 'branchId' | 'active' | 'createdAt' | 'updatedAt'> {}

export interface AgencyCategoryRateInstance
  extends Model<AgencyCategoryRate, AgencyCategoryRateCreationAttributes>,
    AgencyCategoryRate {}

export const AgencyCategoryRate = sequelize.define<AgencyCategoryRateInstance, AgencyCategoryRate>(
  'AgencyCategoryRate',
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
    },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'agencies', key: 'id' },
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
      onDelete: 'CASCADE',
    },
    hourlyRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    tableName: 'agency_category_rates',
  }
)
