'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Cada item do pedido passa a carregar a própria filial — um pedido pode pedir
    // vagas para lojas diferentes.
    await queryInterface.addColumn('order_items', 'branch_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('order_items', ['branch_id']);

    // Backfill: herda a filial do pedido para os itens já existentes.
    await queryInterface.sequelize.query(
      'UPDATE order_items oi SET branch_id = o.branch_id FROM orders o WHERE oi.order_id = o.id AND oi.branch_id IS NULL'
    );

    // A filial do pedido vira apenas "filial principal" (legado) e pode ser nula.
    await queryInterface.changeColumn('orders', 'branch_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'branches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'UPDATE orders o SET branch_id = oi.branch_id FROM order_items oi WHERE oi.order_id = o.id AND o.branch_id IS NULL'
    );
    await queryInterface.changeColumn('orders', 'branch_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'branches', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.removeColumn('order_items', 'branch_id');
  },
};
