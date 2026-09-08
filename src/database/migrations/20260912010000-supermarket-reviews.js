'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Uma vaga pode ter até duas avaliações: uma da agência e uma do supermercado (cliente).
    // O par (job_id, author_role) é único — cada autor avalia a entrega no máximo uma vez.
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX reviews_job_author_role_uk ON reviews (job_id, author_role);'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS reviews_job_author_role_uk;');
  },
};
