'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Antecedência máxima (min) com que o colaborador pode bater o check-in antes do
    // início do turno — atraso nunca é bloqueado. agencies.checkin_early_tolerance_minutes
    // é o padrão da rede; jobs.checkin_early_tolerance_minutes é o override por vaga
    // (NULL = usa o padrão da agência).
    await queryInterface.addColumn('agencies', 'checkin_early_tolerance_minutes', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30,
    });
    await queryInterface.addColumn('jobs', 'checkin_early_tolerance_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'checkin_early_tolerance_minutes');
    await queryInterface.removeColumn('jobs', 'checkin_early_tolerance_minutes');
  },
};
