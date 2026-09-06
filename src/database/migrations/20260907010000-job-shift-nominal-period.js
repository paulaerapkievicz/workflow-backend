'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Período nominal do turno (manhã/tarde/noite/madrugada) — só rótulo/filtro, nunca
    // limita o horário real do turno (que agora é livre e pode atravessar a meia-noite).
    await queryInterface.addColumn('job_shifts', 'nominal_period', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Backfill: deriva o período dos turnos já existentes pela hora de início (fuso de Brasília).
    await queryInterface.sequelize.query(`
      UPDATE job_shifts
      SET nominal_period = CASE
        WHEN EXTRACT(HOUR FROM (start_time AT TIME ZONE 'America/Sao_Paulo')) < 6  THEN 'madrugada'
        WHEN EXTRACT(HOUR FROM (start_time AT TIME ZONE 'America/Sao_Paulo')) < 12 THEN 'manha'
        WHEN EXTRACT(HOUR FROM (start_time AT TIME ZONE 'America/Sao_Paulo')) < 18 THEN 'tarde'
        ELSE 'noite'
      END
      WHERE nominal_period IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('job_shifts', 'nominal_period');
  },
};
