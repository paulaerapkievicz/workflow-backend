'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Pausa/intervalo dentro de um turno — o freelancer (ou a agência) pausa e retoma o
    // ponto sem abandonar a vaga. O tempo de pausa NÃO conta como hora trabalhada.
    await queryInterface.createTable('job_shift_breaks', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      job_shift_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'job_shifts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'jobs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      freelancer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'freelancers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      start_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      // freelancer | agency — quem registrou a pausa
      started_by: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'freelancer',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('job_shift_breaks', ['job_shift_id']);
    await queryInterface.addIndex('job_shift_breaks', ['job_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('job_shift_breaks');
  },
};
