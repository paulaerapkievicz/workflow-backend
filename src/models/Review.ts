// src/models/Review.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface Review {
  id: string
  jobId: string
  freelancerId: string
  rating: number
  comment?: string
  createdAt: Date
  updatedAt: Date
}

export interface ReviewCreationAttributes extends Optional<Review, 'id'> {}

export interface ReviewInstance extends Model<Review, ReviewCreationAttributes>, Review {}

export const Review = sequelize.define<ReviewInstance, Review>(
  'Review',
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
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    comment: {
      type: DataTypes.TEXT,
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
