'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // ENUM -> VARCHAR pra caber o papel 'leader' (líder de agência) sem recriar o tipo.
    // Mesmo padrão de 20260830040000-convert-joblog-eventtype.js / jobs.status.
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" ALTER COLUMN "role" TYPE VARCHAR(255) USING "role"::text;'
    );
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role";');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE \"users\" SET \"role\" = 'agency' WHERE \"role\" = 'leader';"
    );
    await queryInterface.sequelize.query(
      "CREATE TYPE \"enum_users_role\" AS ENUM ('admin', 'supermarket', 'freelancer', 'agency');"
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "users" ALTER COLUMN "role" TYPE "enum_users_role" USING "role"::"enum_users_role";'
    );
  },
};
