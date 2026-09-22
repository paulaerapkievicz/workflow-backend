'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Substitui o gate de onboarding antigo (perfil contratual + uniforme + foto, cada um
    // recomputado ao vivo) por um único status linear em `freelancers`, seguindo as 6 fases do
    // novo fluxo (pré-cadastro -> triagem de documentos -> ASO -> contrato -> assinatura -> ativação).
    await queryInterface.addColumn('freelancers', 'onboarding_status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'draft',
    });
    await queryInterface.addColumn('freelancers', 'onboarding_status_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('freelancers', 'onboarding_activated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Fase 1 (pré-cadastro): fotos de documento, distintas da foto de perfil ("aparência pro
    // trabalho") que já existe em `profile_photo_url`.
    await queryInterface.addColumn('freelancers', 'document_id_photo_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('freelancers', 'address_proof_photo_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('freelancers', 'document_selfie_photo_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Fase 3 (ASO): PDF do atestado de saúde ocupacional, anexado pela agência depois do
    // exame admissional feito por telemedicina (processo externo, não integrado).
    await queryInterface.addColumn('freelancers', 'aso_document_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Colaboradores que já existem hoje já operam sob as regras antigas — não retroagem no
    // novo funil, só quem for criado a partir de agora nasce em 'draft'.
    await queryInterface.sequelize.query(
      `UPDATE freelancers SET onboarding_status = 'active', onboarding_activated_at = NOW()`
    );

    // `approved_at`/`approved_by` do perfil contratual ficam redundantes com `onboarding_status`
    // (a revisão de dados vira a fase `pending_docs_review` -> `pending_aso_upload`).
    await queryInterface.removeColumn('freelancer_contracts', 'approved_at');
    await queryInterface.removeColumn('freelancer_contracts', 'approved_by');
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('freelancer_contracts', 'approved_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('freelancer_contracts', 'approved_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.removeColumn('freelancers', 'aso_document_url');
    await queryInterface.removeColumn('freelancers', 'document_selfie_photo_url');
    await queryInterface.removeColumn('freelancers', 'address_proof_photo_url');
    await queryInterface.removeColumn('freelancers', 'document_id_photo_url');
    await queryInterface.removeColumn('freelancers', 'onboarding_activated_at');
    await queryInterface.removeColumn('freelancers', 'onboarding_status_reason');
    await queryInterface.removeColumn('freelancers', 'onboarding_status');
  },
};
