'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Permissão do gerente de loja para ver/pagar as faturas (fechamento mensal) da rede.
    // Configurável tanto pelo dono do supermercado quanto pela agência-cliente.
    await queryInterface.addColumn('supermarket_members', 'can_view_invoices', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    // Membros que já existiam mantêm o acesso que tinham (antes não havia restrição).
    await queryInterface.sequelize.query(
      `UPDATE supermarket_members SET can_view_invoices = true`
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('supermarket_members', 'can_view_invoices');
  },
};
