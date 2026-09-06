'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Razão social — distinta do nome fantasia (name), pedida no formulário de autocadastro via convite.
    await queryInterface.addColumn('supermarkets', 'legal_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('supermarkets', 'legal_name');
  },
};
