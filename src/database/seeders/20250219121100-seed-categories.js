"use strict";

const crypto = require("crypto");

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      "categories",
      [
        { id: crypto.randomUUID(), name: "Repositor", created_at: new Date(), updated_at: new Date() },
        { id: crypto.randomUUID(), name: "Operador de Caixa", created_at: new Date(), updated_at: new Date() },
        { id: crypto.randomUUID(), name: "Atendente", created_at: new Date(), updated_at: new Date() },
        { id: crypto.randomUUID(), name: "Balconista", created_at: new Date(), updated_at: new Date() },
        { id: crypto.randomUUID(), name: "Estoquista", created_at: new Date(), updated_at: new Date() },
        { id: crypto.randomUUID(), name: "Açougueiro", created_at: new Date(), updated_at: new Date() },
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("categories", null, {}); // Remove todas as categorias
  },
};
