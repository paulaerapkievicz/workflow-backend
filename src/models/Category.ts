// src/models/Category.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface Category {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface CategoryCreationAttributes extends Optional<Category, 'id'> {}

export interface CategoryInstance extends Model<Category, CategoryCreationAttributes>, Category {}

export const Category = sequelize.define<CategoryInstance, Category>(
  'Category',
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
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
