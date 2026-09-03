'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Valor/hora que a agência cobra de UM supermercado por função.
    // branch_id preenchido = tarifa daquela loja; NULL = padrão da rede.
    await queryInterface.createTable('supermarket_category_rates', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      supermarket_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'supermarkets', key: 'id' },
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
      hourly_rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Um padrão por supermercado+função...
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX supermarket_category_rates_default_uk
         ON supermarket_category_rates (supermarket_id, category_id)
         WHERE branch_id IS NULL`
    );
    // ...e um por supermercado+função+filial.
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX supermarket_category_rates_branch_uk
         ON supermarket_category_rates (supermarket_id, category_id, branch_id)
         WHERE branch_id IS NOT NULL`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS supermarket_category_rates_default_uk');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS supermarket_category_rates_branch_uk');
    await queryInterface.dropTable('supermarket_category_rates');
  },
};
