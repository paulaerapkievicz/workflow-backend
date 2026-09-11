'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Sócio de agência: login extra (users.role = 'partner') com acesso amplo e configurável
    // ao painel da agência (ao contrário do líder, cujas permissões são fixas no código).
    await queryInterface.createTable('agency_partners', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      agency_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agencies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      team_role_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'team_roles', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      // { vagas, clientes, colaboradores, financeiro, equipe, configuracoes } -> boolean
      permissions: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addConstraint('agency_partners', {
      fields: ['agency_id', 'user_id'],
      type: 'unique',
      name: 'agency_partners_agency_user_uk',
    });
    await queryInterface.addIndex('agency_partners', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agency_partners');
  },
};
