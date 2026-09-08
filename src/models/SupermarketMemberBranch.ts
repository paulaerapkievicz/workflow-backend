// src/models/SupermarketMemberBranch.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

/** Vínculo de escopo: filiais em que um gerente de supermercado pode atuar. Sem linhas = rede toda. */
export interface SupermarketMemberBranch {
  id: string
  supermarketMemberId: string
  branchId: string
  createdAt: Date
  updatedAt: Date
}

export interface SupermarketMemberBranchCreationAttributes
  extends Optional<SupermarketMemberBranch, 'id' | 'createdAt' | 'updatedAt'> {}

export interface SupermarketMemberBranchInstance
  extends Model<SupermarketMemberBranch, SupermarketMemberBranchCreationAttributes>,
    SupermarketMemberBranch {}

export const SupermarketMemberBranch = sequelize.define<
  SupermarketMemberBranchInstance,
  SupermarketMemberBranch
>(
  'SupermarketMemberBranch',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    supermarketMemberId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'supermarket_members', key: 'id' },
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
  { tableName: 'supermarket_member_branches' }
)
