'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Assinatura eletrônica do contrato pelo colaborador. A linha é imutável depois de criada:
    // uma nova assinatura (ex.: modelo alterado) gera outra linha, preservando o histórico.
    // Trilha de evidências (IP, user-agent, data/hora, hash do conteúdo) para validade legal
    // nos termos do Art. 10, §2º da MP 2.200-2/2001.
    await queryInterface.createTable('freelancer_contract_signatures', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      freelancer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'freelancers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      agency_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agencies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'contract_templates', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      template_title: { type: Sequelize.STRING, allowNull: false },
      rendered_html: { type: Sequelize.TEXT, allowNull: false },
      content_hash: { type: Sequelize.STRING(64), allowNull: false },
      document_path: { type: Sequelize.STRING, allowNull: true },
      signer_name: { type: Sequelize.STRING, allowNull: false },
      signer_cpf: { type: Sequelize.STRING, allowNull: false },
      signer_email: { type: Sequelize.STRING, allowNull: true },
      acceptance_text: { type: Sequelize.TEXT, allowNull: false },
      signed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      ip_address: { type: Sequelize.STRING, allowNull: true },
      user_agent: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'signed' },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('freelancer_contract_signatures', ['freelancer_id']);
    await queryInterface.addIndex('freelancer_contract_signatures', ['agency_id']);
    await queryInterface.addIndex('freelancer_contract_signatures', ['freelancer_id', 'content_hash']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('freelancer_contract_signatures');
  },
};
