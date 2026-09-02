'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Overrides de configuração operacional por vaga (a agência ajusta caso a caso).
    // NULL = usa o padrão da agência (agencies.*).
    await queryInterface.addColumn('jobs', 'checkin_radius', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('jobs', 'cancellation_window_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('jobs', 'require_checkout_photo', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await queryInterface.addColumn('jobs', 'review_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    for (const c of ['checkin_radius', 'cancellation_window_minutes', 'require_checkout_photo', 'review_enabled']) {
      await queryInterface.removeColumn('jobs', c);
    }
  },
};
