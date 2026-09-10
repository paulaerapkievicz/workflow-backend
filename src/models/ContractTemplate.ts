// src/models/ContractTemplate.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

/**
 * Modelo de contrato personalizado pela agência. `bodyHtml` é HTML (subconjunto) com campos
 * de mesclagem `{{token}}` — ver contractMergeService. Apenas um modelo `active` por agência.
 */
export interface ContractTemplate {
  id: string
  agencyId: string
  title: string
  bodyHtml: string
  active: boolean
  createdBy?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ContractTemplateCreationAttributes
  extends Optional<
    ContractTemplate,
    'id' | 'bodyHtml' | 'active' | 'createdBy' | 'createdAt' | 'updatedAt'
  > {}

export interface ContractTemplateInstance
  extends Model<ContractTemplate, ContractTemplateCreationAttributes>,
    ContractTemplate {}

export const ContractTemplate = sequelize.define<ContractTemplateInstance, ContractTemplate>(
  'ContractTemplate',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    agencyId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'agencies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    title: { type: DataTypes.STRING, allowNull: false },
    bodyHtml: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'contract_templates' }
)
