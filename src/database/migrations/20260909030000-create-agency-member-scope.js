'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Escopo opcional do líder. Sem linhas numa tabela = dimensão irrestrita (rede toda).
    await queryInterface.createTable('agency_member_freelancers', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      agency_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agency_members', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      freelancer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'freelancers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addConstraint('agency_member_freelancers', {
      fields: ['agency_member_id', 'freelancer_id'],
      type: 'unique',
      name: 'agency_member_freelancers_uk',
    });

    await queryInterface.createTable('agency_member_branches', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      agency_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agency_members', key: 'id' },
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
    await queryInterface.addConstraint('agency_member_branches', {
      fields: ['agency_member_id', 'branch_id'],
      type: 'unique',
      name: 'agency_member_branches_uk',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agency_member_freelancers');
    await queryInterface.dropTable('agency_member_branches');
  },
};
