'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Pagamento pelo app (Mercado Pago) pra fatura do mercado e compra de uniforme do colaborador
    // é um recurso que a agência pode desligar — nasce ligado (default true) pra preservar o
    // comportamento atual (o gateway já funciona incondicionalmente hoje).
    await queryInterface.addColumn('agencies', 'app_payment_enabled_for_supermarkets', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('agencies', 'app_payment_enabled_for_freelancers', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    // Override por supermercado-cliente — só tem efeito quando a chave-mestra da agência está ligada.
    await queryInterface.addColumn('supermarkets', 'app_payment_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('supermarkets', 'app_payment_enabled');
    await queryInterface.removeColumn('agencies', 'app_payment_enabled_for_freelancers');
    await queryInterface.removeColumn('agencies', 'app_payment_enabled_for_supermarkets');
  },
};
