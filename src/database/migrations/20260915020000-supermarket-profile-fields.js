'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Perfil institucional do supermercado (matriz): e-mail de contato, logotipo e foto.
    await queryInterface.addColumn('supermarkets', 'email', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('supermarkets', 'logo_url', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('supermarkets', 'profile_photo_url', { type: Sequelize.STRING, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('supermarkets', 'email');
    await queryInterface.removeColumn('supermarkets', 'logo_url');
    await queryInterface.removeColumn('supermarkets', 'profile_photo_url');
  },
};
