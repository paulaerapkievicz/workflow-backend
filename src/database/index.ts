import { Sequelize } from 'sequelize'

export const sequelize = new Sequelize({
  dialect: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'workflow_db',
  username: 'workflow',
  password: 'workflow',
	define: {
    underscored: true
  }
}) 