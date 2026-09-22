'use strict';

/**
 * Visibilidade dos menus Carteira/Relatório pro colaborador: oculto por padrão.
 * `agencies.*_visible_to_freelancers` é o padrão da rede; `freelancers.*_visible_override`
 * (NULL = herda o padrão da agência) permite ligar/desligar pra um colaborador específico.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('agencies', 'wallet_visible_to_freelancers', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('agencies', 'report_visible_to_freelancers', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('freelancers', 'wallet_visible_override', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await queryInterface.addColumn('freelancers', 'report_visible_override', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'wallet_visible_to_freelancers');
    await queryInterface.removeColumn('agencies', 'report_visible_to_freelancers');
    await queryInterface.removeColumn('freelancers', 'wallet_visible_override');
    await queryInterface.removeColumn('freelancers', 'report_visible_override');
  },
};
