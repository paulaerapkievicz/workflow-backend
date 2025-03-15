"use strict";

const crypto = require("crypto");

module.exports = {
  async up(queryInterface) {
    // Recupera usuários existentes para associar como owners das agências
    const users = await queryInterface.sequelize.query("SELECT id FROM users LIMIT 3;", {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });

    await queryInterface.bulkInsert(
      "agencies",
      [
        {
          id: crypto.randomUUID(),
          owner_id: users.length > 0 ? users[0].id : null,
          name: "Agência Talentos",
          cnpj: "12.345.678/0001-99",
          address: "Rua Exemplo, 123 - São Paulo, SP",
          phone: "11 98765-4321",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          owner_id: users.length > 1 ? users[1].id : null,
          name: "Agência Conexão",
          cnpj: "98.765.432/0001-88",
          address: "Avenida Central, 456 - Rio de Janeiro, RJ",
          phone: "21 97654-3210",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          owner_id: users.length > 2 ? users[2].id : null,
          name: "Agência Profissionais",
          cnpj: "11.222.333/0001-77",
          address: "Rua das Oportunidades, 789 - Belo Horizonte, MG",
          phone: "31 96547-1234",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("agencies", null, {}); // Remove todas as agências
  },
};
