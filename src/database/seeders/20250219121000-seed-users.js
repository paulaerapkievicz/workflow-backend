"use strict";

const bcrypt = require("bcrypt");
const crypto = require("crypto");

module.exports = {
  async up(queryInterface) {
    const hashedPassword = await bcrypt.hash("123456", 10);

    await queryInterface.bulkInsert(
      "users",
      [
        {
          id: crypto.randomUUID(),
          name: "Admin User",
          email: "admin@email.com",
          password_hash: hashedPassword,
          role: "admin",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          name: "Supermarket Owner",
          email: "supermarket@email.com",
          password_hash: hashedPassword,
          role: "supermarket",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          name: "Freelancer User",
          email: "freelancer@email.com",
          password_hash: hashedPassword,
          role: "freelancer",
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: crypto.randomUUID(),
          name: "Agency Manager",
          email: "agency@email.com",
          password_hash: hashedPassword,
          role: "agency",
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("users", null, {});
  },
};
