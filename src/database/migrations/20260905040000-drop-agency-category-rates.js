'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Substituída por supermarket_category_rates + freelancer_categories.hourly_rate.
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS agency_category_rates_default_uk');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS agency_category_rates_branch_uk');
    await queryInterface.dropTable('agency_category_rates');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('agency_category_rates', {
      id: { allowNull: false, primaryKey: true, type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4 },
      agency_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'agencies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      branch_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'branches', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      hourly_rate: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX agency_category_rates_default_uk
         ON agency_category_rates (agency_id, category_id)
         WHERE branch_id IS NULL`
    );
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX agency_category_rates_branch_uk
         ON agency_category_rates (agency_id, category_id, branch_id)
         WHERE branch_id IS NOT NULL`
    );
  },
};
