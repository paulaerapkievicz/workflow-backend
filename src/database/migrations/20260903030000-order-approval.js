'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'approval_status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'approved',
    });
    await queryInterface.addColumn('orders', 'submitted_by_user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('orders', 'approved_by_user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('orders', 'rejection_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    for (const c of ['approval_status', 'submitted_by_user_id', 'approved_by_user_id', 'rejection_reason']) {
      await queryInterface.removeColumn('orders', c);
    }
  },
};
