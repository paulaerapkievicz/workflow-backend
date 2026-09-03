'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Vaga concluída com horas acima da tolerância fica retida até a agência liberar o pagamento.
    await queryInterface.addColumn('jobs', 'settlement_hold', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('jobs', 'settlement_approved_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('jobs', 'settlement_approved_at');
    await queryInterface.removeColumn('jobs', 'settlement_hold');
  },
};
