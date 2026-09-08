'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Convite de líder carrega o pagamento dele — copiado para o agency_members no resgate.
    await queryInterface.addColumn('invites', 'pay_type', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('invites', 'pay_amount', { type: Sequelize.DECIMAL(10, 2), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('invites', 'pay_type');
    await queryInterface.removeColumn('invites', 'pay_amount');
  },
};
