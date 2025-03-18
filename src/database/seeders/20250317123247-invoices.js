'use strict';

const { v4: uuidv4 } = require('uuid'); // Biblioteca para gerar UUIDs

module.exports = {
  async up(queryInterface, Sequelize) {
    // Buscar todos os supermercados existentes
    const supermarkets = await queryInterface.sequelize.query(
      `SELECT id FROM supermarkets;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Se não houver supermercados, não cria invoices
    if (!supermarkets.length) {
      console.warn('⚠️ Nenhum supermercado encontrado. Seeder de invoices não foi executado.');
      return;
    }

    // Criar invoices dinamicamente para supermercados existentes
    const invoices = supermarkets.map((supermarket, index) => ({
      id: uuidv4(), // Gerando UUID corretamente
      supermarket_id: supermarket.id,
      total_amount: (100 + index * 50).toFixed(2), // Valores variados
      status: index % 2 === 0 ? 'pending' : 'paid', // Alternando entre pending e paid
      created_at: new Date(),
      updated_at: new Date(),
    }));

    // Inserir os invoices no banco
    await queryInterface.bulkInsert('invoices', invoices);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('invoices', null, {});
  }
};
