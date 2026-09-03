// src/models/FreelancerCategory.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { Freelancer } from './Freelancer'
import { Category } from './Category'

export interface FreelancerCategory {
  id: string
  freelancerId: string
  categoryId: string
  /** Valor/hora que o colaborador recebe nessa função (definido pela agência). NULL = ainda não precificada. */
  hourlyRate?: number | null
  createdAt: Date
  updatedAt: Date
}

export interface FreelancerCategoryCreationAttributes
  extends Optional<FreelancerCategory, 'id' | 'hourlyRate' | 'createdAt' | 'updatedAt'> {}

export interface FreelancerCategoryInstance
  extends Model<FreelancerCategory, FreelancerCategoryCreationAttributes>,
    FreelancerCategory {}

export const FreelancerCategory = sequelize.define<FreelancerCategoryInstance, FreelancerCategory>(
  'FreelancerCategory',
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
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
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    hourlyRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
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

// Associações
FreelancerCategory.belongsTo(Freelancer, { foreignKey: 'freelancerId', as: 'freelancer' })
FreelancerCategory.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' })
