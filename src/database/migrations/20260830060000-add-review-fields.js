'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reviews', 'author_role', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('reviews', 'approved', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('reviews', 'author_role');
    await queryInterface.removeColumn('reviews', 'approved');
  },
};
