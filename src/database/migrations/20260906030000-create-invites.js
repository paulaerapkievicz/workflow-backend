'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Convite gerado pela agência pra um supermercado/freelancer/líder se autocadastrar
    // já vinculado a ela, sem etapa de aprovação manual depois (a agência já vetou ao gerar).
    await queryInterface.createTable('invites', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      agency_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agencies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // supermarket | freelancer | leader (leader ainda não pode ser resgatado — sem tabela própria)
      role: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      // pending | used | revoked
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      used_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('invites', ['agency_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('invites');
  },
};
