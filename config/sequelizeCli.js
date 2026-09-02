require('dotenv').config();

// Registra os seeders aplicados (tabela SequelizeData) para não re-executar
// o seed a cada boot em produção.
const common = {
  dialect: 'postgres',
  logging: false,
  seederStorage: 'sequelize',
  define: { underscored: true, timestamps: true },
};

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
      ...common,
      use_env_variable: 'DATABASE_URL',
      dialectOptions: sslDialectOptions,
    }
  : {
      ...common,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      dialectOptions: sslDialectOptions,
    };

module.exports = {
  development: {
    ...common,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'workflow_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
  },
  test: {
    ...common,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME_TEST || 'workflow_db_test',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
  },
  production: productionConfig,
};
