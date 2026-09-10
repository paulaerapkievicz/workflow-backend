// src/models/TeamRole.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const TEAM_ROLE_SCOPES = ['supermarket', 'agency'] as const
export type TeamRoleScope = (typeof TEAM_ROLE_SCOPES)[number]

/**
 * Cargo configurável da equipe (tag tipo "Administrador", "Gerente", "RH"…).
 * `scope` + `ownerId` amarram a lista a um supermercado (`supermarkets.id`) ou a uma
 * agência (`agencies.id`). Cada um gerencia a própria lista.
 */
export interface TeamRole {
  id: string
  scope: TeamRoleScope
  ownerId: string
  name: string
  position: number
  createdAt: Date
  updatedAt: Date
}

export interface TeamRoleCreationAttributes
  extends Optional<TeamRole, 'id' | 'position' | 'createdAt' | 'updatedAt'> {}

export interface TeamRoleInstance
  extends Model<TeamRole, TeamRoleCreationAttributes>,
    TeamRole {}

export const TeamRole = sequelize.define<TeamRoleInstance, TeamRole>(
  'TeamRole',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    scope: { type: DataTypes.STRING, allowNull: false, validate: { isIn: [[...TEAM_ROLE_SCOPES]] } },
    ownerId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'team_roles' }
)
