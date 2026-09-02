// src/models/FreelancerContract.ts

import { sequelize } from '../database'
import { DataTypes, Model, Optional } from 'sequelize'

/** Campos obrigatórios para considerar o perfil contratual "concluído". */
export const REQUIRED_CONTRACT_FIELDS = [
  'fullName', 'cpf', 'rg', 'pisNis', 'birthDate', 'maritalStatus', 'nationality',
  'motherName', 'addressCep', 'addressStreet', 'addressNumber', 'addressNeighborhood',
  'addressCity', 'addressState', 'bankName', 'bankBranch', 'bankAccount',
  'emergencyContactName', 'emergencyContactPhone', 'shirtSize',
] as const

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
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  shirtSize?: string | null
  completedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface FreelancerContractCreationAttributes
  extends Optional<FreelancerContract, 'id' | 'completedAt' | 'createdAt' | 'updatedAt'> {}

export interface FreelancerContractInstance
  extends Model<FreelancerContract, FreelancerContractCreationAttributes>,
    FreelancerContract {}

const str = { type: DataTypes.STRING, allowNull: true }

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
    fullName: str,
    cpf: str,
    rg: str,
    rgIssuer: str,
    pisNis: str,
    birthDate: { type: DataTypes.DATEONLY, allowNull: true },
    gender: str,
    maritalStatus: str,
    nationality: str,
    motherName: str,
    fatherName: str,
    educationLevel: str,
    ctpsNumber: str,
    ctpsSeries: str,
    addressCep: str,
    addressStreet: str,
    addressNumber: str,
    addressComplement: str,
    addressNeighborhood: str,
    addressCity: str,
    addressState: str,
    bankName: str,
    bankBranch: str,
    bankAccount: str,
    bankAccountType: str,
    pixKey: str,
    emergencyContactName: str,
    emergencyContactPhone: str,
    shirtSize: str,
    completedAt: { type: DataTypes.DATE, allowNull: true },
    createdAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: 'freelancer_contracts' }
)
