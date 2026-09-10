'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Perfil institucional da agência: razão social, e-mail de contato, logotipo e foto de perfil.
    // `active` permite ao admin desativar uma agência sem apagar o histórico.
    await queryInterface.addColumn('agencies', 'legal_name', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('agencies', 'email', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('agencies', 'logo_url', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('agencies', 'profile_photo_url', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('agencies', 'active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'legal_name');
    await queryInterface.removeColumn('agencies', 'email');
    await queryInterface.removeColumn('agencies', 'logo_url');
    await queryInterface.removeColumn('agencies', 'profile_photo_url');
    await queryInterface.removeColumn('agencies', 'active');
  },
};
