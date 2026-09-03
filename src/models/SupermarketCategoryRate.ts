// src/models/SupermarketCategoryRate.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface SupermarketCategoryRate {
  id: string
  supermarketId: string
  categoryId: string
  /** Filial específica; NULL = valor padrão da rede para essa função. */
  branchId?: string | null
  hourlyRate: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SupermarketCategoryRateCreationAttributes
  extends Optional<SupermarketCategoryRate, 'id' | 'branchId' | 'active' | 'createdAt' | 'updatedAt'> {}

export interface SupermarketCategoryRateInstance
  extends Model<SupermarketCategoryRate, SupermarketCategoryRateCreationAttributes>,
    SupermarketCategoryRate {}

export const SupermarketCategoryRate = sequelize.define<
  SupermarketCategoryRateInstance,
  SupermarketCategoryRate
>(
  'SupermarketCategoryRate',
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
    tableName: 'supermarket_category_rates',
  }
)
