'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // { horarios, valores } -> boolean. Ver/atuar em vagas (pool, alocações, ao vivo, alertas)
    // continua sempre liberado pro líder, sem toggle — só a edição de horário/valor é configurável.
    await queryInterface.addColumn('agency_members', 'permissions', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: { horarios: true, valores: true },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('agency_members', 'permissions');
  },
};
