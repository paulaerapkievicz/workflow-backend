// src/models/Agency.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'
import { User } from './User'
import { UnfilledAlertTier, DEFAULT_UNFILLED_ALERT_TIERS } from '../helpers/alerts'
import { StatusColors, DEFAULT_STATUS_COLORS } from '../helpers/statusColors'

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
  /** Intervalo padrão (min) sugerido/aplicável a um turno da vaga — descontado das horas contratadas. */
  defaultBreakMinutes: number
  /** Teto de horas de um único turno (jornada legal). */
  maxShiftHours: number
  /** Teto de horas somadas de todos os turnos de uma vaga (jornada legal). */
  maxJobHours: number
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
  /** Faixas das bolinhas de "vaga sem colaborador" na tela de Convocações. */
  unfilledAlertTiers: UnfilledAlertTier[]
  /** Cores dos 6 tons dos badges de status (personalizável pela agência). */
  statusColors: StatusColors
  /** Ordem personalizada do menu lateral (lista de hrefs). NULL = ordem padrão. */
  sidebarOrder?: string[] | null
  onboardingRequired: boolean
  /** Exige a compra do uniforme (via este app) para o colaborador aceitar vagas; some do onboarding quando desligado. */
  requireUniformPurchase: boolean
  /** Exige aprovação da agência para a foto de perfil enviada no onboarding; sem isso, a foto enviada já vale direto. */
  requirePhotoApproval: boolean
  uniformPrice: number
  allowSelfRegistration: boolean
  /** Liga/desliga o pagamento da fatura mensal pelo app pros mercados-clientes (chave-mestra; override por cliente em Supermarket.appPaymentEnabled). */
  appPaymentEnabledForSupermarkets: boolean
  /** Liga/desliga a compra do uniforme pelo app pros colaboradores (tudo ou nada, sem granularidade por pessoa). */
  appPaymentEnabledForFreelancers: boolean
  /** Número de WhatsApp (com DDI) usado no botão de contato da landing pública (/p/:id). */
  whatsappNumber?: string | null
  /** Mensagem pré-preenchida do botão de WhatsApp da landing. */
  whatsappMessage?: string | null
  /** Política de e-mail de login das contas criadas sob a agência: 'informed' = o e-mail que a
   *  pessoa informou (padrão); 'pattern' = gerado como nomesobrenome@workflow.com — nesse caso
   *  só a agência consegue redefinir a senha se a pessoa esquecer. */
  loginEmailPolicy: 'informed' | 'pattern'
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
    | 'defaultBreakMinutes'
    | 'maxShiftHours'
    | 'maxJobHours'
    | 'checkinEarlyToleranceMinutes'
    | 'alertsEnabled'
    | 'notifySupermarketOnAlerts'
    | 'lateCheckinToleranceMinutes'
    | 'lateCheckinCriticalMinutes'
    | 'earlyCheckoutToleranceMinutes'
    | 'missingCheckoutGraceMinutes'
    | 'unfilledAlertLeadMinutes'
    | 'shortNoticeWithdrawalMinutes'
    | 'unfilledAlertTiers'
    | 'statusColors'
    | 'sidebarOrder'
    | 'onboardingRequired'
    | 'requireUniformPurchase'
    | 'requirePhotoApproval'
    | 'uniformPrice'
    | 'allowSelfRegistration'
    | 'appPaymentEnabledForSupermarkets'
    | 'appPaymentEnabledForFreelancers'
    | 'whatsappNumber'
    | 'whatsappMessage'
    | 'loginEmailPolicy'
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
  defaultBreakMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  maxShiftHours: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 10
  },
  maxJobHours: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
    defaultValue: 10
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
  unfilledAlertTiers: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: DEFAULT_UNFILLED_ALERT_TIERS
  },
  statusColors: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: DEFAULT_STATUS_COLORS
  },
  sidebarOrder: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  onboardingRequired: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  requireUniformPurchase: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  requirePhotoApproval: {
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
  appPaymentEnabledForSupermarkets: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  appPaymentEnabledForFreelancers: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  whatsappNumber: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  whatsappMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  loginEmailPolicy: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'informed',
    validate: { isIn: [['informed', 'pattern']] }
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
