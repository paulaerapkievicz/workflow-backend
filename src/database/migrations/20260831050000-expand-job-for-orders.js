'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jobs', 'order_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'orders', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('jobs', 'order_item_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'order_items', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('jobs', 'monthly_invoice_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'invoices', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('jobs', 'gross_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('jobs', 'contracted_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('jobs', 'worked_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('jobs', 'completed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    // O valor agora é definido pela agência (tabela de valor/hora), não pelo supermercado.
    await queryInterface.changeColumn('jobs', 'payment_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'UPDATE "jobs" SET "payment_amount" = 0 WHERE "payment_amount" IS NULL;'
    );
    await queryInterface.changeColumn('jobs', 'payment_amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    });
    for (const col of [
      'order_id', 'order_item_id', 'monthly_invoice_id', 'gross_amount',
      'contracted_minutes', 'worked_minutes', 'completed_at',
    ]) {
      await queryInterface.removeColumn('jobs', col);
    }
  },
};
