const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    const branches = [];

    // Supermercados e quantidades de filiais desejadas
    const supermarkets = [
      { id: '8e1d9fee-6b65-4378-b995-481d09e502ac', name: 'Supermercado Popular', filialCount: 1 },
      { id: '6a4644f3-9f9a-4229-9f57-1e0105e5a4a1', name: 'Supermercado Qualidade', filialCount: 3 },
      { id: '7c17c841-5e20-4002-bc43-d29a20bf48a1', name: 'Supermercado Econômico', filialCount: 5 },
      { id: 'b5fb5e66-b21c-4c6e-9439-2330e2ad1599', name: 'Supermercado Central', filialCount: 0 }, // Nenhuma filial
    ];

    // Gerando filiais de acordo com a quantidade definida
    supermarkets.forEach((supermarket) => {
      for (let i = 1; i <= supermarket.filialCount; i++) {
        branches.push({
          id: uuidv4(),
          supermarket_id: supermarket.id,
          name: `Filial ${i} - ${supermarket.name}`,
          address: `Rua ${String.fromCharCode(64 + i)}, ${100 + i}`,
          phone: `11 9000${i}-0000`,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    });

    // Inserindo no banco
    await queryInterface.bulkInsert('branches', branches);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('branches', null, {});
  },
};
