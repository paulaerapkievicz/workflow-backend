import { sequelize } from '../database';
import { DataTypes, Model, Optional } from 'sequelize';

export interface FreelancerLocationAttributes {
  id: string;
  freelancerId: string;
  jobId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FreelancerLocationCreationAttributes
  extends Optional<FreelancerLocationAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export interface FreelancerLocationInstance
  extends Model<FreelancerLocationAttributes, FreelancerLocationCreationAttributes>,
    FreelancerLocationAttributes {}

export const FreelancerLocation = sequelize.define<
  FreelancerLocationInstance,
  FreelancerLocationAttributes
>(
  'FreelancerLocation',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    freelancerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'freelancers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    jobId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'jobs', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: false,
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: false,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'freelancer_locations',
    timestamps: true,
    underscored: true,
  }
);