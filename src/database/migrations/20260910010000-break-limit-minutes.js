'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Limite de minutos de pausa por turno. NULL = sem limite.
    // jobs.break_limit_minutes é o override por vaga (NULL = usa o padrão da agência).
    await queryInterface.addColumn('agencies', 'break_limit_minutes', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('jobs', 'break_limit_minutes', { type: Sequelize.INTEGER, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agencies', 'break_limit_minutes');
    await queryInterface.removeColumn('jobs', 'break_limit_minutes');
  },
};
