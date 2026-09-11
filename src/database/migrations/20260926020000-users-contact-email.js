'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Guarda o e-mail que a pessoa de fato informou no cadastro, mesmo quando o login
    // (`users.email`) passa a ser o padrão nomesobrenome@workflow.com (ver
    // agencies.login_email_policy). Sem backfill — contas antigas ficam null.
    await queryInterface.addColumn('users', 'contact_email', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'contact_email');
  },
};
