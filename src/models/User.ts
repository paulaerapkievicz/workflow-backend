// src/models/User.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

export interface User {
  id: string
  name: string
  email: string
  /** E-mail que a pessoa de fato informou no cadastro — mesmo quando `email` (login) é o
   *  padrão nomesobrenome@workflow.com (ver Agency.loginEmailPolicy). */
  contactEmail?: string | null
  passwordHash: string
  role: 'admin' | 'supermarket' | 'freelancer' | 'agency' | 'leader' | 'partner'
  phone?: string | null
  birthDate?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface UserCreationAttributes
  extends Optional<User, 'id' | 'contactEmail' | 'phone' | 'birthDate' | 'createdAt' | 'updatedAt'> {}

export interface UserInstance extends Model<User, UserCreationAttributes>, User {}

export const User = sequelize.define<UserInstance, User>('User', {
  id: {
    allowNull: false,
    primaryKey: true,
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    // Rede de segurança — a validação com mensagem amigável fica nos serviços/controllers.
    validate: { isEmail: { msg: 'E-mail inválido.' } }
  },
  contactEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // Coluna convertida de ENUM para VARCHAR (migration 20260909010000) para caber o papel 'leader'
  // sem recriar o tipo a cada valor novo — mesmo padrão de jobs.status / job_logs.event_type.
  // 'partner' (sócio de agência) reaproveita o mesmo VARCHAR — ver AgencyPartner.
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [['admin', 'supermarket', 'freelancer', 'agency', 'leader', 'partner']] }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  birthDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
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
