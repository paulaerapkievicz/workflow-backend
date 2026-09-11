'use strict';

/**
 * `agencies.sidebar_order` / `supermarkets.sidebar_order` — ordem personalizada do menu
 * lateral (lista de hrefs), editável pelo dono em /agency/settings e /supermarket/profile.
 * `null` = ordem padrão do sistema.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('agencies', 'sidebar_order', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('supermarkets', 'sidebar_order', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'sidebar_order');
    await queryInterface.removeColumn('supermarkets', 'sidebar_order');
  },
};
