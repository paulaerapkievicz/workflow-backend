'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Valor/hora que o colaborador recebe por função (definido pela agência no vínculo).
    await queryInterface.addColumn('freelancer_categories', 'hourly_rate', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('freelancer_categories', 'hourly_rate');
  },
};
