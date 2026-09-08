'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // --- Escopo por várias filiais para o gerente de supermercado ---
    // Mesma ideia do líder de agência: sem linhas nesta tabela = rede toda;
    // com linhas = o gerente só atua nessas filiais.
    await queryInterface.createTable('supermarket_member_branches', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      supermarket_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'supermarket_members', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      branch_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'branches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addConstraint('supermarket_member_branches', {
      fields: ['supermarket_member_id', 'branch_id'],
      type: 'unique',
      name: 'supermarket_member_branches_uk',
    });

    // Migra o vínculo antigo (uma filial por gerente) para a nova tabela.
    await queryInterface.sequelize.query(`
      INSERT INTO supermarket_member_branches (id, supermarket_member_id, branch_id, created_at, updated_at)
      SELECT gen_random_uuid(), id, branch_id, NOW(), NOW()
      FROM supermarket_members
      WHERE branch_id IS NOT NULL
    `);
    await queryInterface.removeColumn('supermarket_members', 'branch_id');

    // --- Permissão separada: ver x pagar a fatura ---
    // Quem vê não necessariamente paga. Pagar (e contestar) exige esta segunda flag.
    await queryInterface.addColumn('supermarket_members', 'can_pay_invoices', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    // Quem já podia ver as faturas mantém também o pagar (comportamento anterior).
    await queryInterface.sequelize.query(
      `UPDATE supermarket_members SET can_pay_invoices = can_view_invoices`
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('supermarket_members', 'can_pay_invoices');
    await queryInterface.addColumn('supermarket_members', 'branch_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.sequelize.query(`
      UPDATE supermarket_members sm
      SET branch_id = (
        SELECT smb.branch_id FROM supermarket_member_branches smb
        WHERE smb.supermarket_member_id = sm.id
        ORDER BY smb.created_at ASC LIMIT 1
      )
    `);
    await queryInterface.dropTable('supermarket_member_branches');
  },
};
