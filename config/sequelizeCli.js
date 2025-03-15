require('dotenv').config();

module.exports = {
  development: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'workflow_db',
    username: process.env.DB_USER || 'workflow',
    password: process.env.DB_PASS || 'workflow',
    logging: false,
    define: {
      underscored: true,
      timestamps: true
    }
  },
  test: {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME_TEST || 'workflow_db_test',
    username: process.env.DB_USER || 'workflow',
    password: process.env.DB_PASS || 'workflow',
    logging: false,
    define: {
      underscored: true,
      timestamps: true
    }
  },
  production: {
    dialect: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    logging: false,
    define: {
      underscored: true,
      timestamps: true
    }
  }
};





// require('dotenv').config();
// const { Sequelize } = require('sequelize');

// const config = {
//   dialect: 'postgres',
//   host: process.env.DB_HOST || 'localhost',
//   port: Number(process.env.DB_PORT) || 5432,
//   database: process.env.DB_NAME || 'workflow_db',
//   username: process.env.DB_USER || 'workflow',
//   password: process.env.DB_PASS || 'workflow',
//   logging: false,
//   define: {
//     underscored: true, 
//     timestamps: true
//   }
// };

// const sequelize = new Sequelize(config);

// module.exports = sequelize;
