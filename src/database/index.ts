import { Sequelize, Options } from 'sequelize'

// Reutiliza a mesma configuração usada pelo sequelize-cli (config/sequelizeCli.js),
// que por sua vez carrega o .env. Assim a aplicação e as migrations apontam
// sempre para o mesmo banco.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cliConfig = require('../../config/sequelizeCli') as Record<string, Options>

const env = process.env.NODE_ENV || 'development'
const config = cliConfig[env] || cliConfig.development

export const sequelize = new Sequelize({
  ...config,
  dialect: 'postgres',
})
