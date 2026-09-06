'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Filial cadastrada pela agência já nasce liberada; cadastrada pelo próprio supermercado
    // fica pendente até a agência aprovar o atendimento (POST /branches/:id/approve).
    // Default 'approved' no backfill: as filiais já existentes nasceram de um fluxo confiável.
    await queryInterface.addColumn('branches', 'service_status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'approved',
    });
    await queryInterface.addColumn('branches', 'approved_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('branches', 'approved_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('branches', 'approved_by');
    await queryInterface.removeColumn('branches', 'approved_at');
    await queryInterface.removeColumn('branches', 'service_status');
  },
};
