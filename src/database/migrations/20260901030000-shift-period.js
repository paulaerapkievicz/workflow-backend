'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jobs', 'shift_period', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('order_items', 'shift_period', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('jobs', 'shift_period');
    await queryInterface.removeColumn('order_items', 'shift_period');
  },
};
