'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crédito lançado pela agência na carteira do líder (debita o saldo da agência).
    await queryInterface.createTable('agency_member_payments', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      agency_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agency_members', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      // 'YYYY-MM' quando payType = 'mensal' (evita pagar o mesmo mês 2x)
      reference_month: { type: Sequelize.STRING, allowNull: true },
      note: { type: Sequelize.STRING, allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('agency_member_payments', ['agency_member_id']);
    // Único por (líder, mês) — só quando reference_month não é nulo.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX agency_member_payments_member_month_uk ' +
        'ON agency_member_payments (agency_member_id, reference_month) ' +
        'WHERE reference_month IS NOT NULL;'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agency_member_payments');
  },
};
