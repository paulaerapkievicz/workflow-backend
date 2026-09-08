'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Contestação/abatimento de um fechamento mensal pelo supermercado (ex.: quebra de caixa).
    // O supermercado lança (status `pending`); a agência aprova ou recusa. Só os `approved`
    // reduzem o valor a pagar da fatura (`invoices.adjustments_total`) e a agência absorve o
    // abатimento (débito em `agencies.available_balance` na aprovação).
    await queryInterface.createTable('invoice_adjustments', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      description: { type: Sequelize.STRING, allowNull: false },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      resolved_by: { type: Sequelize.UUID, allowNull: true },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
      agency_note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('invoice_adjustments', ['invoice_id', 'status']);

    await queryInterface.addColumn('invoices', 'adjustments_total', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'adjustments_total');
    await queryInterface.dropTable('invoice_adjustments');
  },
};
