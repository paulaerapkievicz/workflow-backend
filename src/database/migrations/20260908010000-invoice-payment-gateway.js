'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Pagamento da fatura mensal via gateway real (Mercado Pago), no mesmo modelo do uniforme:
    // o supermercado é redirecionado pro link de pagamento e a fatura só vira `paid` quando o
    // gateway confirma (webhook ou consulta sob demanda). (Pendência 11.)
    await queryInterface.addColumn('invoices', 'payment_provider', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'payment_ref', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'payment_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'paid_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'paid_at');
    await queryInterface.removeColumn('invoices', 'payment_url');
    await queryInterface.removeColumn('invoices', 'payment_ref');
    await queryInterface.removeColumn('invoices', 'payment_provider');
  },
};
