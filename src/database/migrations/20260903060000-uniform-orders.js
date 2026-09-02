'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('freelancers', 'onboarding_approved_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.createTable('uniform_orders', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      freelancer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'freelancers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      shirt_size: { type: Sequelize.STRING, allowNull: false },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      // pending_payment | paid | shipped | delivered | photo_submitted | approved | rejected
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending_payment' },
      payment_provider: { type: Sequelize.STRING, allowNull: true },
      payment_ref: { type: Sequelize.STRING, allowNull: true },
      payment_url: { type: Sequelize.TEXT, allowNull: true },
      shipping_address: { type: Sequelize.JSONB, allowNull: true },
      tracking_code: { type: Sequelize.STRING, allowNull: true },
      selfie_photo_url: { type: Sequelize.STRING, allowNull: true },
      rejection_reason: { type: Sequelize.TEXT, allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      shipped_at: { type: Sequelize.DATE, allowNull: true },
      delivered_at: { type: Sequelize.DATE, allowNull: true },
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.addIndex('uniform_orders', ['freelancer_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('uniform_orders');
    await queryInterface.removeColumn('freelancers', 'onboarding_approved_at');
  },
};
