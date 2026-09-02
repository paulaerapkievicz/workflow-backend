'use strict';

/**
 * Autocadastro de colaboradores controlado pela agência.
 * - agencies.allow_self_registration: a agência abre/fecha o autocadastro.
 * - freelancers.document: CPF informado no cadastro simples.
 * - freelancers.registration_status: pending | approved | rejected
 *   (colaborador que se autocadastrou fica "pending" até a agência aprovar).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('agencies', 'allow_self_registration', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('freelancers', 'document', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('freelancers', 'registration_status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'approved',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'allow_self_registration');
    await queryInterface.removeColumn('freelancers', 'document');
    await queryInterface.removeColumn('freelancers', 'registration_status');
  },
};
