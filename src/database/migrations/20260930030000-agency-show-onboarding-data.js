'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Desligado (padrão): o perfil do colaborador só traz foto/nome/e-mail/telefone/Pix. Ligado,
    // mostra também os dados do pré-cadastro (somente consulta) e o contrato assinado.
    await queryInterface.addColumn('agencies', 'show_onboarding_data_to_freelancer', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'show_onboarding_data_to_freelancer');
  },
};
