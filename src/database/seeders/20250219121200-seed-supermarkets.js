"use strict";

const crypto = require("crypto");

module.exports = {
  async up(queryInterface) {
    // Recupera um usuário existente para ser o owner (Ajuste conforme necessário)
    const users = await queryInterface.sequelize.query("SELECT id FROM users LIMIT 1;", {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });

    if (users.length === 0) {
      throw new Error("Nenhum usuário encontrado. Crie um usuário antes de rodar este seeder.");
    }

    await queryInterface.bulkInsert(
      "supermarkets",
      [
        {
          id: crypto.randomUUID(),
          owner_id: users[0].id,
          name: "Supermercado Central",
          cnpj: "12.345.678/0001-99",
          address: "Rua das Compras, 123",
          phone: "11 98765-4321",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          owner_id: users[0].id,
          name: "Supermercado Econômico",
          cnpj: "98.765.432/0001-88",
          address: "Avenida Principal, 456",
          phone: "11 99999-0000",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          owner_id: users[0].id,
          name: "Supermercado Qualidade",
          cnpj: "22.333.444/0001-55",
          address: "Rua dos Alimentos, 789",
          phone: "11 91234-5678",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          owner_id: users[0].id,
          name: "Supermercado Popular",
          cnpj: "77.888.999/0001-22",
          address: "Travessa dos Preços Baixos, 321",
          phone: "11 93456-7890",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("supermarkets", null, {}); // Remove todos os supermercados
  },
};
