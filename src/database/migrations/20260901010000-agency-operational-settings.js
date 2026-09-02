'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('agencies', 'checkin_radius', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 300,
    });
    await queryInterface.addColumn('agencies', 'cancellation_window_minutes', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30,
    });
    await queryInterface.addColumn('agencies', 'require_checkout_photo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('agencies', 'review_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
  async down(queryInterface) {
    for (const c of ['checkin_radius', 'cancellation_window_minutes', 'require_checkout_photo', 'review_enabled']) {
      await queryInterface.removeColumn('agencies', c);
    }
  },
};
