'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Dados cadastrais próprios da filial. Todos nullable: vazio = herda o valor da matriz
    // (resolvido em helpers/branchProfile.ts).
    await queryInterface.addColumn('branches', 'legal_name', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('branches', 'cnpj', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('branches', 'email', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('branches', 'logo_url', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('branches', 'profile_photo_url', { type: Sequelize.STRING, allowNull: true });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('branches', 'legal_name');
    await queryInterface.removeColumn('branches', 'cnpj');
    await queryInterface.removeColumn('branches', 'email');
    await queryInterface.removeColumn('branches', 'logo_url');
    await queryInterface.removeColumn('branches', 'profile_photo_url');
  },
};
