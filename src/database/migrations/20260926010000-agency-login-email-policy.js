'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Política de e-mail de login das contas criadas sob a agência (freelancer, supermercado,
    // líder, sócio): 'informed' = e-mail que a pessoa informou (padrão, comportamento atual);
    // 'pattern' = gerado como nomesobrenome@workflow.com — nesse caso só a agência consegue
    // redefinir a senha se a pessoa esquecer, já que não é um e-mail real que ela controla.
    await queryInterface.addColumn('agencies', 'login_email_policy', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'informed',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'login_email_policy');
  },
};
