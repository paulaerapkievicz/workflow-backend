'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Crédito automático de um líder `por_colaborador`: cada vaga concluída por um
    // colaborador do escopo do líder rende `amount` (= agency_members.pay_type snapshot).
    // status: released = carteira já creditada / agência já debitada; pending = a agência
    // ainda decide se paga (colaborador desistiu, saiu antes, troca etc.); canceled = a
    // agência decidiu não pagar.
    await queryInterface.createTable('agency_member_job_credits', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      agency_member_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agency_members', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      job_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'jobs', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      freelancer_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'freelancers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'released' },
      note: { type: Sequelize.STRING, allowNull: true },
      released_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('agency_member_job_credits', ['agency_member_id', 'status']);
    // Uma vaga rende no máximo um crédito por líder.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX agency_member_job_credits_member_job_uk ' +
        'ON agency_member_job_credits (agency_member_id, job_id);'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('agency_member_job_credits');
  },
};
