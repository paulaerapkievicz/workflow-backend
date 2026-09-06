'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Cada supermercado é cliente de exatamente uma agência (relação comercial exclusiva).
    await queryInterface.addColumn('supermarkets', 'agency_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'agencies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    // Backfill: hoje só existe uma agência nos dados existentes, então é seguro atribuir
    // todos os supermercados já cadastrados a ela. Um ambiente com múltiplas agências
    // ambíguas precisaria de um backfill manual antes de rodar esta migration.
    await queryInterface.sequelize.query(
      `UPDATE supermarkets SET agency_id = (SELECT id FROM agencies ORDER BY created_at ASC LIMIT 1) WHERE agency_id IS NULL`
    );

    await queryInterface.changeColumn('supermarkets', 'agency_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'agencies', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });

    await queryInterface.addIndex('supermarkets', ['agency_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('supermarkets', ['agency_id']);
    await queryInterface.removeColumn('supermarkets', 'agency_id');
  },
};
