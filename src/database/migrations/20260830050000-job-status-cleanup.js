'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE \"jobs\" SET \"status\" = 'completed' WHERE \"status\" IN ('awaiting_approval', 'approved', 'paid');"
    );
    await queryInterface.sequelize.query(
      "UPDATE \"payments\" SET \"status\" = 'settled' WHERE \"status\" IN ('paid', 'pending');"
    );
  },
  async down() {
    // Sem rollback: os estados antigos não são reconstituíveis com segurança.
  },
};
