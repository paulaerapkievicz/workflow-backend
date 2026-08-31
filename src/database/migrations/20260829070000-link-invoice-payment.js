'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('invoices', 'payment_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'payments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('invoices', 'job_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'jobs', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'payment_id');
    await queryInterface.removeColumn('invoices', 'job_id');
  },
};
