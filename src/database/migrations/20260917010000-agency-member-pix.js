'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('agency_members', 'pix_key', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('agency_members', 'pix_key_type', { type: Sequelize.STRING, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('agency_members', 'pix_key');
    await queryInterface.removeColumn('agency_members', 'pix_key_type');
  },
};
