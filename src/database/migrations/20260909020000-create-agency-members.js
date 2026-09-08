'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Líder de agência: login extra (users.role = 'leader') com poderes operacionais
    // (vagas + colaboradores) e nenhum acesso financeiro. Valor de pagamento + carteira próprios.
    await queryInterface.createTable('agency_members', {
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
      // hora | diaria | mensal
      pay_type: { type: Sequelize.STRING, allowNull: true },
      pay_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      available_balance: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addConstraint('agency_members', {
      fields: ['agency_id', 'user_id'],
      type: 'unique',
      name: 'agency_members_agency_user_uk',
    });
    await queryInterface.addIndex('agency_members', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agency_members');
  },
};
