import { Sequelize, Options } from 'sequelize'

// Reutiliza a mesma configuração usada pelo sequelize-cli (config/sequelizeCli.js),
// que por sua vez carrega o .env. Assim a aplicação e as migrations apontam
// sempre para o mesmo banco.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cliConfig = require('../../config/sequelizeCli') as Record<string, Options & { use_env_variable?: string }>

const env = process.env.NODE_ENV || 'development'
const config = cliConfig[env] || cliConfig.development

// Em produção o host pode fornecer só a connection string (DATABASE_URL).
export const sequelize = config.use_env_variable
  ? new Sequelize(process.env[config.use_env_variable] as string, { ...config, dialect: 'postgres' })
  : new Sequelize({ ...config, dialect: 'postgres' })
