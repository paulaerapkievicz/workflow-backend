'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('agencies', 'available_balance', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('agencies', 'commission_percentage', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 10,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'available_balance');
    await queryInterface.removeColumn('agencies', 'commission_percentage');
  },
};
