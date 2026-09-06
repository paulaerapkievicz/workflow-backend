'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Pausa/intervalo no ponto é um recurso que a agência libera — desligado por padrão,
    // ligável no geral (agências) e com override opcional por vaga (jobs, NULL = usa o geral).
    await queryInterface.addColumn('agencies', 'breaks_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('jobs', 'breaks_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('jobs', 'breaks_enabled');
    await queryInterface.removeColumn('agencies', 'breaks_enabled');
  },
};
