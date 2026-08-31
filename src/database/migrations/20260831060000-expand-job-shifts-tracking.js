'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('job_shifts', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'pending',
    });
    await queryInterface.addColumn('job_shifts', 'check_in_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('job_shifts', 'check_out_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('job_shifts', 'worked_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    for (const col of ['status', 'check_in_at', 'check_out_at', 'worked_minutes']) {
      await queryInterface.removeColumn('job_shifts', col);
    }
  },
};
