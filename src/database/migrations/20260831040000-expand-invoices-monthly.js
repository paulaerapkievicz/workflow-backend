'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('invoices', 'agency_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'agencies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('invoices', 'type', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'job',
    });
    await queryInterface.addColumn('invoices', 'reference_month', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'period_start', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'period_end', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'total_jobs', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'contracted_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'worked_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    for (const col of [
      'agency_id', 'type', 'reference_month', 'period_start', 'period_end',
      'total_jobs', 'contracted_minutes', 'worked_minutes',
    ]) {
      await queryInterface.removeColumn('invoices', col);
    }
  },
};
