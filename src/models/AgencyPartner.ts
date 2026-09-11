// src/models/AgencyPartner.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { AgencyPartnerPermissions, defaultPartnerPermissions } from '../helpers/agencyPartnerPermissions'

/**
 * Sócio de agência: um login extra (User.role = 'partner') com acesso amplo/configurável
 * ao painel da agência — diferente do líder (`AgencyMember`), cujo conjunto de poderes é
 * pequeno e fixo. O sócio nasce com acesso total (`permissions` todas `true`) e o dono da
 * agência restringe funcionalidade por funcionalidade quando quiser. Sem escopo de
 * colaborador/filial (não é um cargo operacional, é um perfil de acesso ao aplicativo).
 * Sem pagamento/carteira própria — sócio não é remunerado pela plataforma.
 */
export interface AgencyPartner {
  id: string
  agencyId: string
  userId: string
  active: boolean
  /** Cargo configurável na equipe (`team_roles`, scope 'agency') — CEO, Sócio, Administrador… */
  teamRoleId?: string | null
  permissions: AgencyPartnerPermissions
  createdAt: Date
  updatedAt: Date
}

export interface AgencyPartnerCreationAttributes
  extends Optional<AgencyPartner, 'id' | 'active' | 'teamRoleId' | 'permissions' | 'createdAt' | 'updatedAt'> {}

export interface AgencyPartnerInstance
  extends Model<AgencyPartner, AgencyPartnerCreationAttributes>,
    AgencyPartner {}

export const AgencyPartner = sequelize.define<AgencyPartnerInstance, AgencyPartner>(
  'AgencyPartner',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'agencies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    teamRoleId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'team_roles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: defaultPartnerPermissions(),
    },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'agency_partners' }
)
