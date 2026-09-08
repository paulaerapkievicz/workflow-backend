// src/models/AgencyMemberFreelancer.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

/** Vínculo de escopo: colaboradores que um líder pode gerenciar. Sem linhas = todos. */
export interface AgencyMemberFreelancer {
  id: string
  agencyMemberId: string
  freelancerId: string
  createdAt: Date
  updatedAt: Date
}

export interface AgencyMemberFreelancerCreationAttributes
  extends Optional<AgencyMemberFreelancer, 'id' | 'createdAt' | 'updatedAt'> {}

export interface AgencyMemberFreelancerInstance
  extends Model<AgencyMemberFreelancer, AgencyMemberFreelancerCreationAttributes>,
    AgencyMemberFreelancer {}

export const AgencyMemberFreelancer = sequelize.define<
  AgencyMemberFreelancerInstance,
  AgencyMemberFreelancer
>(
  'AgencyMemberFreelancer',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agencyMemberId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'agency_members', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    freelancerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'freelancers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'agency_member_freelancers' }
)
