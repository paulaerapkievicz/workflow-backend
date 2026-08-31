'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('job_logs', 'job_shift_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'job_shifts', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('job_logs', 'latitude', {
      type: Sequelize.DECIMAL(10, 6),
      allowNull: true,
    });
    await queryInterface.addColumn('job_logs', 'longitude', {
      type: Sequelize.DECIMAL(10, 6),
      allowNull: true,
    });
    await queryInterface.addColumn('job_logs', 'accuracy', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    for (const col of ['job_shift_id', 'latitude', 'longitude', 'accuracy']) {
      await queryInterface.removeColumn('job_logs', col);
    }
  },
};
