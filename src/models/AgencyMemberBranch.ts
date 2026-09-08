// src/models/AgencyMemberBranch.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

/** Vínculo de escopo: filiais em que um líder pode atuar. Sem linhas = todas. */
export interface AgencyMemberBranch {
  id: string
  agencyMemberId: string
  branchId: string
  createdAt: Date
  updatedAt: Date
}

export interface AgencyMemberBranchCreationAttributes
  extends Optional<AgencyMemberBranch, 'id' | 'createdAt' | 'updatedAt'> {}

export interface AgencyMemberBranchInstance
  extends Model<AgencyMemberBranch, AgencyMemberBranchCreationAttributes>,
    AgencyMemberBranch {}

export const AgencyMemberBranch = sequelize.define<AgencyMemberBranchInstance, AgencyMemberBranch>(
  'AgencyMemberBranch',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agencyMemberId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'agency_members', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    branchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'branches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'agency_member_branches' }
)
