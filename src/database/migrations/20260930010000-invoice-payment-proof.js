'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Comprovante de pagamento manual anexado pelo supermercado (fatura mensal, quando o
    // pagamento pelo app está desligado) + revisão da agência (aprova -> baixa a fatura;
    // recusa -> grava o motivo e o supermercado reenvia). Coluna paralela ao `status` (que
    // continua um ENUM de verdade) pra não precisar alterar o tipo dele.
    await queryInterface.addColumn('invoices', 'payment_proof_url', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'payment_proof_status', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'payment_proof_note', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'payment_proof_uploaded_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'payment_proof_reviewed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('invoices', 'payment_proof_reviewed_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invoices', 'payment_proof_reviewed_by');
    await queryInterface.removeColumn('invoices', 'payment_proof_reviewed_at');
    await queryInterface.removeColumn('invoices', 'payment_proof_uploaded_at');
    await queryInterface.removeColumn('invoices', 'payment_proof_note');
    await queryInterface.removeColumn('invoices', 'payment_proof_status');
    await queryInterface.removeColumn('invoices', 'payment_proof_url');
  },
};
