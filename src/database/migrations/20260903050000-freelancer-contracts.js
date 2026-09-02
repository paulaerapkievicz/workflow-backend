'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('freelancer_contracts', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      freelancer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'freelancers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      full_name: { type: Sequelize.STRING },
      cpf: { type: Sequelize.STRING },
      rg: { type: Sequelize.STRING },
      rg_issuer: { type: Sequelize.STRING },
      pis_nis: { type: Sequelize.STRING },
      birth_date: { type: Sequelize.DATEONLY },
      gender: { type: Sequelize.STRING },
      marital_status: { type: Sequelize.STRING },
      nationality: { type: Sequelize.STRING },
      mother_name: { type: Sequelize.STRING },
      father_name: { type: Sequelize.STRING },
      education_level: { type: Sequelize.STRING },
      ctps_number: { type: Sequelize.STRING },
      ctps_series: { type: Sequelize.STRING },
      address_cep: { type: Sequelize.STRING },
      address_street: { type: Sequelize.STRING },
      address_number: { type: Sequelize.STRING },
      address_complement: { type: Sequelize.STRING },
      address_neighborhood: { type: Sequelize.STRING },
      address_city: { type: Sequelize.STRING },
      address_state: { type: Sequelize.STRING },
      bank_name: { type: Sequelize.STRING },
      bank_branch: { type: Sequelize.STRING },
      bank_account: { type: Sequelize.STRING },
      bank_account_type: { type: Sequelize.STRING },
      pix_key: { type: Sequelize.STRING },
      emergency_contact_name: { type: Sequelize.STRING },
      emergency_contact_phone: { type: Sequelize.STRING },
      shirt_size: { type: Sequelize.STRING },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('freelancer_contracts');
  },
};
