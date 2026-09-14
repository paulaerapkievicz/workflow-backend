'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Pedido do dono (2026-09-14): pagamento pelo app deve nascer DESLIGADO pra agências e
    // supermercados novos — só muda o default da coluna, agências/clientes já cadastrados mantêm
    // o valor atual (que hoje é true pra todo mundo, por causa do default anterior).
    await queryInterface.changeColumn('agencies', 'app_payment_enabled_for_supermarkets', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.changeColumn('agencies', 'app_payment_enabled_for_freelancers', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.changeColumn('supermarkets', 'app_payment_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('agencies', 'app_payment_enabled_for_supermarkets', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.changeColumn('agencies', 'app_payment_enabled_for_freelancers', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.changeColumn('supermarkets', 'app_payment_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },
};
