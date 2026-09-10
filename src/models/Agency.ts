// src/models/Agency.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { User } from './User'

export interface Agency {
  id: string
  ownerId: string
  name: string
  legalName?: string | null
  cnpj: string
  address: string
  phone?: string
  email?: string | null
  logoUrl?: string | null
  profilePhotoUrl?: string | null
  active: boolean
  availableBalance: number
  commissionPercentage: number
  checkinRadius: number
  cancellationWindowMinutes: number
  requireCheckoutPhoto: boolean
  reviewEnabled: boolean
  breaksEnabled: boolean
  /** Limite de minutos de pausa por turno (NULL = sem limite). */
  breakLimitMinutes?: number | null
  /** Antecedência máxima (min) para bater o check-in antes do início do turno. */
  checkinEarlyToleranceMinutes: number
  /** Controle de ocorrências das vagas (atraso, falta, saída antecipada…). */
  alertsEnabled: boolean
  notifySupermarketOnAlerts: boolean
  lateCheckinToleranceMinutes: number
  lateCheckinCriticalMinutes: number
  earlyCheckoutToleranceMinutes: number
  missingCheckoutGraceMinutes: number
  unfilledAlertLeadMinutes: number
  shortNoticeWithdrawalMinutes: number
  onboardingRequired: boolean
  uniformPrice: number
  allowSelfRegistration: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AgencyCreationAttributes
  extends Optional<
    Agency,
    | 'id'
    | 'legalName'
    | 'phone'
    | 'email'
    | 'logoUrl'
    | 'profilePhotoUrl'
    | 'active'
    | 'availableBalance'
    | 'commissionPercentage'
    | 'checkinRadius'
    | 'cancellationWindowMinutes'
    | 'requireCheckoutPhoto'
    | 'reviewEnabled'
    | 'breaksEnabled'
    | 'breakLimitMinutes'
    | 'checkinEarlyToleranceMinutes'
    | 'alertsEnabled'
    | 'notifySupermarketOnAlerts'
    | 'lateCheckinToleranceMinutes'
    | 'lateCheckinCriticalMinutes'
    | 'earlyCheckoutToleranceMinutes'
    | 'missingCheckoutGraceMinutes'
    | 'unfilledAlertLeadMinutes'
    | 'shortNoticeWithdrawalMinutes'
    | 'onboardingRequired'
    | 'uniformPrice'
    | 'allowSelfRegistration'
    | 'createdAt'
    | 'updatedAt'
  > {}

export interface AgencyInstance extends Model<Agency, AgencyCreationAttributes>, Agency {}

export const Agency = sequelize.define<AgencyInstance, Agency>('Agency', {
  id: {
    allowNull: false,
    primaryKey: true,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4
  },
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  legalName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  cnpj: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  logoUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profilePhotoUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  availableBalance: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  commissionPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 10
  },
  checkinRadius: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 300
  },
  cancellationWindowMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30
  },
  requireCheckoutPhoto: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  reviewEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  breaksEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  breakLimitMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  checkinEarlyToleranceMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30
  },
  alertsEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  notifySupermarketOnAlerts: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  lateCheckinToleranceMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10
  },
  lateCheckinCriticalMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30
  },
  earlyCheckoutToleranceMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 15
  },
  missingCheckoutGraceMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 20
  },
  unfilledAlertLeadMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 120
  },
  shortNoticeWithdrawalMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 180
  },
  onboardingRequired: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  uniformPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  allowSelfRegistration: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
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
})

// Associação com User (Owner da Agência)
Agency.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' })
