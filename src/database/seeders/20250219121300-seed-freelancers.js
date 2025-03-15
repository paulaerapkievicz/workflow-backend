"use strict";

const crypto = require("crypto");

module.exports = {
  async up(queryInterface) {
    // Recupera uma agência existente para associar ao freelancer (Ajuste conforme necessário)
    const agencies = await queryInterface.sequelize.query("SELECT id FROM agencies LIMIT 1;", {
      type: queryInterface.sequelize.QueryTypes.SELECT,
    });

    await queryInterface.bulkInsert(
      "freelancers",
      [
        {
          id: crypto.randomUUID(),
          agency_id: agencies.length > 0 ? agencies[0].id : null,
          name: "João Silva",
          email: "joao@email.com",
          phone: "11 99999-9999",
          skills: "Repositor",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          agency_id: agencies.length > 0 ? agencies[0].id : null,
          name: "Maria Santos",
          email: "maria@email.com",
          phone: "11 98888-8888",
          skills: "Operador de Caixa",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          agency_id: agencies.length > 0 ? agencies[0].id : null,
          name: "Carlos Oliveira",
          email: "carlos@email.com",
          phone: "11 97777-7777",
          skills: "Atendente",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          agency_id: agencies.length > 0 ? agencies[0].id : null,
          name: "Ana Pereira",
          email: "ana@email.com",
          phone: "11 96666-6666",
          skills: "Balconista",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          agency_id: agencies.length > 0 ? agencies[0].id : null,
          name: "Fernando Lima",
          email: "fernando@email.com",
          phone: "11 95555-5555",
          skills: "Estoquista",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          agency_id: agencies.length > 0 ? agencies[0].id : null,
          name: "Beatriz Souza",
          email: "beatriz@email.com",
          phone: "11 94444-4444",
          skills: "Açougueiro",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("freelancers", null, {}); // Remove todos os freelancers
  },
};
