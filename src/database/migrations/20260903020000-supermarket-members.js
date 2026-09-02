'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Vários usuários por rede de supermercado (gerentes de loja / RH).
    await queryInterface.createTable('supermarket_members', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      supermarket_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'supermarkets', key: 'id' },
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
      // NULL = acesso à rede toda (dono / RH da matriz); preenchido = gerente de uma loja.
      branch_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'branches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      can_submit_orders: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      can_approve_orders: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_owner: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addConstraint('supermarket_members', {
      fields: ['supermarket_id', 'user_id'],
      type: 'unique',
      name: 'supermarket_members_supermarket_user_uk',
    });
    await queryInterface.addIndex('supermarket_members', ['user_id']);

    // Membro dono para cada supermercado já existente.
    await queryInterface.sequelize.query(
      `INSERT INTO supermarket_members
         (id, supermarket_id, user_id, branch_id, can_submit_orders, can_approve_orders, is_owner, created_at, updated_at)
       SELECT gen_random_uuid(), s.id, s.owner_id, NULL, true, true, true, NOW(), NOW()
       FROM supermarkets s`
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('supermarket_members');
  },
};
