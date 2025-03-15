'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('job_logs', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'jobs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      freelancer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'freelancers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      event_type: {
        type: Sequelize.ENUM('check-in', 'check-out', 'break-start', 'break-end'),
        allowNull: false
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        // defaultValue: Sequelize.literal('NOW()')
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()')
      }
    });

  // Criando índices para otimizar consultas
  await queryInterface.addIndex('job_logs', ['job_id']);
  await queryInterface.addIndex('job_logs', ['freelancer_id']);

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('job_logs');
  }
};
