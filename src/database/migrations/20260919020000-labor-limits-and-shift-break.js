'use strict';

/**
 * Intervalo do turno + teto legal de horas.
 * - `job_shifts.break_minutes`  — intervalo (não remunerado) daquele turno, descontado do contratado.
 * - `agencies.default_break_minutes / max_shift_hours / max_job_hours` — padrões da agência.
 * - `jobs.default_break_minutes / max_shift_hours / max_job_hours` — overrides por vaga (NULL = usa o da agência).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('job_shifts', 'break_minutes', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('agencies', 'default_break_minutes', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('agencies', 'max_shift_hours', {
      type: Sequelize.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 10,
    });
    await queryInterface.addColumn('agencies', 'max_job_hours', {
      type: Sequelize.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 10,
    });

    await queryInterface.addColumn('jobs', 'default_break_minutes', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('jobs', 'max_shift_hours', {
      type: Sequelize.DECIMAL(4, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('jobs', 'max_job_hours', {
      type: Sequelize.DECIMAL(4, 2),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('jobs', 'max_job_hours');
    await queryInterface.removeColumn('jobs', 'max_shift_hours');
    await queryInterface.removeColumn('jobs', 'default_break_minutes');
    await queryInterface.removeColumn('agencies', 'max_job_hours');
    await queryInterface.removeColumn('agencies', 'max_shift_hours');
    await queryInterface.removeColumn('agencies', 'default_break_minutes');
    await queryInterface.removeColumn('job_shifts', 'break_minutes');
  },
};
