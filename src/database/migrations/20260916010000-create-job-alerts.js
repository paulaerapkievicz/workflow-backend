'use strict';

/**
 * Controle de ocorrências das vagas: atraso no check-in, falta (no-show), saída antecipada,
 * turno sem check-out, vaga descoberta, pausa estourada, etc. Uma ocorrência viva por
 * (vaga, turno, tipo) — `dedupe_key` unique. Nunca é apagada (log de incidentes).
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('job_alerts', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'jobs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      job_shift_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'job_shifts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      freelancer_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'freelancers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      type: { type: Sequelize.STRING, allowNull: false },
      severity: { type: Sequelize.STRING, allowNull: false, defaultValue: 'warning' },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'open' },
      title: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      context: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      audience: { type: Sequelize.JSONB, allowNull: false, defaultValue: ['agency', 'leader'] },
      dedupe_key: { type: Sequelize.STRING, allowNull: false },
      detected_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      acknowledged_at: { type: Sequelize.DATE, allowNull: true },
      acknowledged_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
      resolved_by: { type: Sequelize.STRING, allowNull: true },
      resolved_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      resolution_code: { type: Sequelize.STRING, allowNull: true },
      resolution_note: { type: Sequelize.TEXT, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.addConstraint('job_alerts', {
      fields: ['dedupe_key'],
      type: 'unique',
      name: 'job_alerts_dedupe_key_uk',
    });
    await queryInterface.addIndex('job_alerts', ['job_id'], { name: 'job_alerts_job_id_idx' });
    await queryInterface.addIndex('job_alerts', ['status', 'severity'], {
      name: 'job_alerts_status_severity_idx',
    });
    await queryInterface.addIndex('job_alerts', ['type'], { name: 'job_alerts_type_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('job_alerts');
  },
};
