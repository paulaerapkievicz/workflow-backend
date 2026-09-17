// src/models/AgencyMember.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { AgencyMemberPermissions, defaultAgencyMemberPermissions } from '../helpers/agencyMemberPermissions'
import { PixKeyType, PIX_KEY_TYPES } from './Withdrawal'

export const AGENCY_MEMBER_PAY_TYPES = ['hora', 'diaria', 'mensal', 'por_colaborador'] as const
export type AgencyMemberPayType = (typeof AGENCY_MEMBER_PAY_TYPES)[number]

/**
 * Líder de agência: um login extra (User.role = 'leader') que gerencia vagas e o cadastro
 * de colaboradores de uma agência, sem nenhum acesso financeiro/contábil. Pode ter um
 * escopo (subconjunto de colaboradores e/ou de filiais) — sem escopo = rede toda.
 * Tem valor de pagamento próprio e carteira própria (creditada pela agência, sacável).
 * `permissions` só cobre o que é configurável (editar horário/ponto, editar valor/hora do
 * colaborador) — ver/atuar em vagas continua sempre liberado, sem toggle.
 */
export interface AgencyMember {
  id: string
  agencyId: string
  userId: string
  active: boolean
  payType?: AgencyMemberPayType | null
  payAmount?: number | null
  availableBalance: number
  /** Cargo configurável na equipe (`team_roles`, scope 'agency'). NULL = sem cargo. */
  teamRoleId?: string | null
  /** Chave Pix informada no próprio cadastro (não é a mesma coleta feita na hora do saque). */
  pixKey?: string | null
  pixKeyType?: PixKeyType | null
  permissions: AgencyMemberPermissions
  createdAt: Date
  updatedAt: Date
}

export interface AgencyMemberCreationAttributes
  extends Optional<
    AgencyMember,
    | 'id'
    | 'active'
    | 'payType'
    | 'payAmount'
    | 'availableBalance'
    | 'teamRoleId'
    | 'pixKey'
    | 'pixKeyType'
    | 'permissions'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface AgencyMemberInstance
  extends Model<AgencyMember, AgencyMemberCreationAttributes>,
    AgencyMember {}

export const AgencyMember = sequelize.define<AgencyMemberInstance, AgencyMember>(
  'AgencyMember',
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
    payType: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isIn: [[...AGENCY_MEMBER_PAY_TYPES]] },
    },
    payAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    availableBalance: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    teamRoleId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'team_roles', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    pixKey: { type: DataTypes.STRING, allowNull: true },
    pixKeyType: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isIn: [[...PIX_KEY_TYPES]] },
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: defaultAgencyMemberPermissions(),
    },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'agency_members' }
)
