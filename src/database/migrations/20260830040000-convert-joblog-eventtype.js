'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "job_logs" ALTER COLUMN "event_type" TYPE VARCHAR(255) USING "event_type"::text;'
    );
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_job_logs_event_type";');

    await queryInterface.addColumn('job_logs', 'reason', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('job_logs', 'reason');
    await queryInterface.sequelize.query(
      "CREATE TYPE \"enum_job_logs_event_type\" AS ENUM ('check-in', 'check-out', 'break-start', 'break-end');"
    );
    await queryInterface.sequelize.query(
      "UPDATE \"job_logs\" SET \"event_type\" = 'check-in' WHERE \"event_type\" NOT IN ('check-in','check-out','break-start','break-end');"
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "job_logs" ALTER COLUMN "event_type" TYPE "enum_job_logs_event_type" USING "event_type"::"enum_job_logs_event_type";'
    );
  },
};
