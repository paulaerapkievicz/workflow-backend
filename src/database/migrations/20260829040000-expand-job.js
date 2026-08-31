'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jobs', 'title', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'Vaga sem título',
    });
    await queryInterface.addColumn('jobs', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // ENUM -> VARCHAR para permitir novos estados sem alterar tipos no Postgres.
    await queryInterface.sequelize.query('ALTER TABLE "jobs" ALTER COLUMN "status" DROP DEFAULT;');
    await queryInterface.sequelize.query(
      'ALTER TABLE "jobs" ALTER COLUMN "status" TYPE VARCHAR(255) USING "status"::text;'
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE \"jobs\" ALTER COLUMN \"status\" SET DEFAULT 'pending';"
    );
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_jobs_status";');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('jobs', 'title');
    await queryInterface.removeColumn('jobs', 'description');
    await queryInterface.sequelize.query('ALTER TABLE "jobs" ALTER COLUMN "status" DROP DEFAULT;');
    await queryInterface.sequelize.query(
      "CREATE TYPE \"enum_jobs_status\" AS ENUM ('pending', 'accepted', 'completed', 'canceled');"
    );
    await queryInterface.sequelize.query(
      "UPDATE \"jobs\" SET \"status\" = 'pending' WHERE \"status\" NOT IN ('pending','accepted','completed','canceled');"
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "jobs" ALTER COLUMN "status" TYPE "enum_jobs_status" USING "status"::"enum_jobs_status";'
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE \"jobs\" ALTER COLUMN \"status\" SET DEFAULT 'pending';"
    );
  },
};
