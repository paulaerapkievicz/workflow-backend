'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('freelancers', 'blocked_until', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('freelancers', 'rating_avg', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('freelancers', 'rating_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('freelancers', 'blocked_until');
    await queryInterface.removeColumn('freelancers', 'rating_avg');
    await queryInterface.removeColumn('freelancers', 'rating_count');
  },
};
