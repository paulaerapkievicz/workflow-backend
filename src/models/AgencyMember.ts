// src/models/AgencyMember.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export const AGENCY_MEMBER_PAY_TYPES = ['hora', 'diaria', 'mensal'] as const
export type AgencyMemberPayType = (typeof AGENCY_MEMBER_PAY_TYPES)[number]

/**
 * Líder de agência: um login extra (User.role = 'leader') que gerencia vagas e o cadastro
 * de colaboradores de uma agência, sem nenhum acesso financeiro/contábil. Pode ter um
 * escopo (subconjunto de colaboradores e/ou de filiais) — sem escopo = rede toda.
 * Tem valor de pagamento próprio e carteira própria (creditada pela agência, sacável).
 */
export interface AgencyMember {
  id: string
  agencyId: string
  userId: string
  active: boolean
  payType?: AgencyMemberPayType | null
  payAmount?: number | null
  availableBalance: number
  createdAt: Date
  updatedAt: Date
}

export interface AgencyMemberCreationAttributes
  extends Optional<
    AgencyMember,
    'id' | 'active' | 'payType' | 'payAmount' | 'availableBalance' | 'createdAt' | 'updatedAt'
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
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'agency_members' }
)
