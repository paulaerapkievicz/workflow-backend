'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Quem disparou um log withdrawn/no-show — 'freelancer' (desistência/abandono por conta
    // própria) ou 'agency' (liberação, falta registrada, troca de colaborador). NULL nos
    // registros antigos (pré-feature) e em eventos que não se aplicam (check-in/out, pausas).
    // Usado pra distinguir "Desistência"/"Abandono" (o próprio colaborador) de "vaga liberada
    // pela agência", que hoje usa o mesmo eventType 'withdrawn'.
    await queryInterface.addColumn('job_logs', 'initiated_by', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('job_logs', 'initiated_by');
  },
};
