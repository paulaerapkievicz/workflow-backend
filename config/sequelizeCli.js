require('dotenv').config();

const define = { underscored: true, timestamps: true };

// Provedores gerenciados (Neon, Railway, Render) exigem conexão SSL.
// Deixe DB_SSL=false apenas para um Postgres local sem TLS.
const sslEnabled = String(process.env.DB_SSL ?? 'true').toLowerCase() !== 'false';
const sslDialectOptions = sslEnabled
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : {};

// Em produção o host normalmente entrega uma única connection string.
// Aceita DATABASE_URL (padrão Neon/Railway) e cai para as variáveis DB_* soltas.
const productionConfig = process.env.DATABASE_URL
  ? {
      use_env_variable: 'DATABASE_URL',
      dialect: 'postgres',
      logging: false,
      dialectOptions: sslDialectOptions,
      define,
    }
  : {
      dialect: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      logging: false,
      dialectOptions: sslDialectOptions,
      define,
    };

module.exports = {
  development: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'workflow_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    logging: false,
    define,
  },
  test: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME_TEST || 'workflow_db_test',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    logging: false,
    define,
  },
  production: productionConfig,
};
