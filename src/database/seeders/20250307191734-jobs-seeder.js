'use strict';

const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Buscar IDs das tabelas relacionadas
    const supermarkets = await queryInterface.sequelize.query(
      `SELECT id FROM supermarkets;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const branches = await queryInterface.sequelize.query(
      `SELECT id FROM branches;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const categories = await queryInterface.sequelize.query(
      `SELECT id FROM categories;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const freelancers = await queryInterface.sequelize.query(
      `SELECT id FROM freelancers;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Garantir que existam registros para relacionamento
    if (!supermarkets.length || !branches.length || !categories.length) {
      throw new Error('Supermarkets, branches ou categories estão vazios. Popule essas tabelas antes de rodar este seeder.');
    }
    // Lista de status possíveis para o trabalho
    const statuses = ['pending', 'accepted', 'completed', 'canceled'];

    // Criar trabalhos para cada status possível
    const jobs = statuses.flatMap(status => [
      {
        id: uuidv4(),
        supermarket_id: supermarkets[0].id,
        branch_id: branches[0].id,
        category_id: categories[0].id,
        freelancer_id: freelancers.length ? freelancers[0].id : null,
        status: status, // Usando o status iterado
        start_time: new Date(),
        end_time: new Date(new Date().getTime() + 3 * 60 * 60 * 1000), // +3 horas
        payment_amount: 150.00,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        supermarket_id: supermarkets[0].id,
        branch_id: branches[0].id,
        category_id: categories[0].id,
        freelancer_id: freelancers.length > 1 ? freelancers[1].id : null,
        status: status, // Usando o status iterado
        start_time: new Date(),
        end_time: new Date(new Date().getTime() + 2 * 60 * 60 * 1000), // +2 horas
        payment_amount: 120.00,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    await queryInterface.bulkInsert('jobs', jobs, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('jobs', null, {});
  }
};
