'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Modelo de contrato que a agência personaliza (editor rich-text). O corpo é HTML com
    // campos de mesclagem {{token}} preenchidos a partir do onboarding do colaborador.
    await queryInterface.createTable('contract_templates', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      agency_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agencies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      title: { type: Sequelize.STRING, allowNull: false },
      body_html: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('contract_templates', ['agency_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('contract_templates');
  },
};
