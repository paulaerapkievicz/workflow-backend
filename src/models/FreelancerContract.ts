// src/models/FreelancerContract.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

/**
 * Campos obrigatórios para considerar o perfil contratual "concluído". Só entram aqui dados
 * de fato necessários para a contratação — dados de conta bancária e contato de emergência
 * são informativos e ficam de fora (o colaborador pode completá-los depois).
 */
export const REQUIRED_CONTRACT_FIELDS = [
  'fullName', 'cpf', 'rg', 'pisNis', 'birthDate', 'maritalStatus', 'nationality',
  'motherName', 'ctpsNumber', 'addressCep', 'addressStreet', 'addressNumber', 'addressNeighborhood',
  'addressCity', 'addressState', 'pixKey', 'pixKeyType',
] as const

/**
 * Tipos de chave Pix aceitos no onboarding do colaborador — sem `cnpj`, que representa uma
 * pessoa jurídica e não faz sentido como chave pessoal. `freelancerContractService.upsert`
 * confere que a chave realmente pertence ao colaborador (CPF/e-mail/telefone batendo com o
 * cadastro dele); `aleatoria` não tem como ser conferida sem integração com o Banco Central.
 */
export const FREELANCER_PIX_KEY_TYPES = ['cpf', 'email', 'telefone', 'aleatoria'] as const
export type FreelancerPixKeyType = (typeof FREELANCER_PIX_KEY_TYPES)[number]

export interface FreelancerContract {
  id: string
  freelancerId: string
  fullName?: string | null
  cpf?: string | null
  rg?: string | null
  rgIssuer?: string | null
  pisNis?: string | null
  birthDate?: string | null
  gender?: string | null
  maritalStatus?: string | null
  nationality?: string | null
  motherName?: string | null
  fatherName?: string | null
  educationLevel?: string | null
  ctpsNumber?: string | null
  ctpsSeries?: string | null
  addressCep?: string | null
  addressStreet?: string | null
  addressNumber?: string | null
  addressComplement?: string | null
  addressNeighborhood?: string | null
  addressCity?: string | null
  addressState?: string | null
  bankName?: string | null
  bankBranch?: string | null
  bankAccount?: string | null
  bankAccountType?: string | null
  pixKey?: string | null
  pixKeyType?: FreelancerPixKeyType | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  shirtSize?: string | null
  completedAt?: Date | null
  /** Preenchido quando a agência confere os dados e confirma — libera a seção no perfil e o contrato. */
  approvedAt?: Date | null
  approvedBy?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface FreelancerContractCreationAttributes
  extends Optional<
    FreelancerContract,
    'id' | 'completedAt' | 'approvedAt' | 'approvedBy' | 'createdAt' | 'updatedAt'
  > {}

export interface FreelancerContractInstance
  extends Model<FreelancerContract, FreelancerContractCreationAttributes>,
    FreelancerContract {}

const str = () => ({ type: DataTypes.STRING, allowNull: true })

export const FreelancerContract = sequelize.define<FreelancerContractInstance, FreelancerContract>(
  'FreelancerContract',
  {
    id: { allowNull: false, primaryKey: true, type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
    freelancerId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: { model: 'freelancers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    fullName: str(),
    cpf: str(),
    rg: str(),
    rgIssuer: str(),
    pisNis: str(),
    birthDate: { type: DataTypes.DATEONLY, allowNull: true },
    gender: str(),
    maritalStatus: str(),
    nationality: str(),
    motherName: str(),
    fatherName: str(),
    educationLevel: str(),
    ctpsNumber: str(),
    ctpsSeries: str(),
    addressCep: str(),
    addressStreet: str(),
    addressNumber: str(),
    addressComplement: str(),
    addressNeighborhood: str(),
    addressCity: str(),
    addressState: str(),
    bankName: str(),
    bankBranch: str(),
    bankAccount: str(),
    bankAccountType: str(),
    pixKey: str(),
    pixKeyType: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isIn: [[...FREELANCER_PIX_KEY_TYPES]] },
    },
    emergencyContactName: str(),
    emergencyContactPhone: str(),
    shirtSize: str(),
    completedAt: { type: DataTypes.DATE, allowNull: true },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'freelancer_contracts' }
)
