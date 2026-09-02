'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Valor/hora pode ser específico por filial (branch_id preenchido) ou padrão da rede (NULL).
    await queryInterface.addColumn('agency_category_rates', 'branch_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.removeConstraint(
      'agency_category_rates',
      'agency_category_rates_agency_category_uk'
    );

    // Um padrão por agência+categoria...
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX agency_category_rates_default_uk
         ON agency_category_rates (agency_id, category_id)
         WHERE branch_id IS NULL`
    );
    // ...e um por agência+categoria+filial.
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX agency_category_rates_branch_uk
         ON agency_category_rates (agency_id, category_id, branch_id)
         WHERE branch_id IS NOT NULL`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS agency_category_rates_default_uk');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS agency_category_rates_branch_uk');
    await queryInterface.sequelize.query(
      'DELETE FROM agency_category_rates WHERE branch_id IS NOT NULL'
    );
    await queryInterface.removeColumn('agency_category_rates', 'branch_id');
    await queryInterface.addConstraint('agency_category_rates', {
      fields: ['agency_id', 'category_id'],
      type: 'unique',
      name: 'agency_category_rates_agency_category_uk',
    });
  },
};
