'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Chave Pix do beneficiário — o admin usa pra pagar o saque por fora e dar baixa.
    await queryInterface.addColumn('withdrawals', 'pix_key', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('withdrawals', 'pix_key_type', { type: Sequelize.STRING, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('withdrawals', 'pix_key');
    await queryInterface.removeColumn('withdrawals', 'pix_key_type');
  },
};
