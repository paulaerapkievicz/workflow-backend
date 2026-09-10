'use strict';

/**
 * `categories.active` — função inativa some das combos (perfil do colaborador, valores/hora
 * do supermercado, pedido de vagas). Os cadastros existentes ficam ativos.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('categories', 'active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('categories', 'active');
  },
};
