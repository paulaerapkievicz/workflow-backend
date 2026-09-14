'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Duas obrigatoriedades independentes (antes bundladas em `onboarding_required`):
    // compra de uniforme e aprovação de foto pela agência. Cada uma, desligada (padrão),
    // esconde a seção correspondente no onboarding do colaborador.
    await queryInterface.addColumn('agencies', 'require_uniform_purchase', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('agencies', 'require_photo_approval', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // A foto de perfil vira um fluxo próprio (antes era a "selfie de uniforme", presa ao
    // pedido de uniforme). Sem aprovação obrigatória, a foto enviada no onboarding já nasce 'approved'.
    await queryInterface.addColumn('freelancers', 'profile_photo_status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'none',
    });
    await queryInterface.addColumn('freelancers', 'profile_photo_rejection_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('freelancers', 'profile_photo_submitted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('freelancers', 'profile_photo_reviewed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // `onboarding_approved_at` era só um cache — agora calculado ao vivo (perfil contratual +
    // uniforme entregue, se exigido + foto aprovada, se exigida), então o cache some.
    await queryInterface.removeColumn('freelancers', 'onboarding_approved_at');

    // Uniforme perde os campos de selfie/revisão (agora vivem em `freelancers.profile_photo_*`);
    // fica só o ciclo de compra/envio: pending_payment -> paid -> shipped -> delivered.
    await queryInterface.sequelize.query(
      `UPDATE uniform_orders SET status = 'delivered' WHERE status IN ('photo_submitted', 'approved', 'rejected')`
    );
    await queryInterface.removeColumn('uniform_orders', 'selfie_photo_url');
    await queryInterface.removeColumn('uniform_orders', 'rejection_reason');
    await queryInterface.removeColumn('uniform_orders', 'reviewed_at');
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('uniform_orders', 'reviewed_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('uniform_orders', 'rejection_reason', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('uniform_orders', 'selfie_photo_url', { type: Sequelize.STRING, allowNull: true });

    await queryInterface.addColumn('freelancers', 'onboarding_approved_at', { type: Sequelize.DATE, allowNull: true });

    await queryInterface.removeColumn('freelancers', 'profile_photo_reviewed_at');
    await queryInterface.removeColumn('freelancers', 'profile_photo_submitted_at');
    await queryInterface.removeColumn('freelancers', 'profile_photo_rejection_reason');
    await queryInterface.removeColumn('freelancers', 'profile_photo_status');

    await queryInterface.removeColumn('agencies', 'require_photo_approval');
    await queryInterface.removeColumn('agencies', 'require_uniform_purchase');
  },
};
