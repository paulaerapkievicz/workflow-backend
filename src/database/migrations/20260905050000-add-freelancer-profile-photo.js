'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Foto de perfil do freelancer (diferente das fotos de checkout e da selfie de uniforme).
    await queryInterface.addColumn('freelancers', 'profile_photo_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('freelancers', 'profile_photo_url');
  },
};
