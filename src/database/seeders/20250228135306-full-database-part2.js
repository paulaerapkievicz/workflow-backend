const { v4: uuidv4 } = require('uuid');
const { Sequelize } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const jobs = await queryInterface.sequelize.query(
      'SELECT id, freelancer_id, supermarket_id FROM jobs;',
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Logs de trabalhos
    const jobLogs = jobs.flatMap(job => [
      { id: uuidv4(), job_id: job.id, freelancer_id: job.freelancer_id, event_type: 'check-in', timestamp: new Date(), created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), job_id: job.id, freelancer_id: job.freelancer_id, event_type: 'check-out', timestamp: new Date(), created_at: new Date(), updated_at: new Date() }
    ]);
    await queryInterface.bulkInsert('job_logs', jobLogs);

    // Pagamentos
    const payments = jobs.map(job => ({
      id: uuidv4(),
      job_id: job.id,
      freelancer_id: job.freelancer_id,
      amount: 100.00,
      status: 'pending', // Agora está correto
      created_at: new Date(),
      updated_at: new Date()
    }));
    await queryInterface.bulkInsert('payments', payments);

    // Reviews
    const reviews = jobs.map(job => ({
      id: uuidv4(),
      job_id: job.id,
      freelancer_id: job.freelancer_id,
      rating: 5,
      comment: 'Ótimo trabalho!',
      created_at: new Date(),
      updated_at: new Date()
    }));
    await queryInterface.bulkInsert('reviews', reviews);

    // Faturas (Invoices) - Agora buscando `supermarket_id` corretamente
    const invoiceEntries = jobs.map(job => ({
      id: uuidv4(),
      supermarket_id: job.supermarket_id, // Pegando da tabela correta
      total_amount: 500.00,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    }));
    await queryInterface.bulkInsert('invoices', invoiceEntries);

    // Comissões
    const agencies = await queryInterface.sequelize.query(
      'SELECT id FROM agencies;',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const commissions = agencies.map(agency => ({
      id: uuidv4(),
      agency_id: agency.id,
      percentage: 10.0,
      created_at: new Date(),
      updated_at: new Date()
    }));
    await queryInterface.bulkInsert('commissions', commissions);

    // Sessões
    const users = await queryInterface.sequelize.query(
      'SELECT id FROM users;',
      { type: Sequelize.QueryTypes.SELECT }
    );
    const sessions = users.map(user => ({
      id: uuidv4(),
      user_id: user.id,
      token: uuidv4(),
      created_at: new Date(),
      updated_at: new Date()
    }));
    await queryInterface.bulkInsert('sessions', sessions);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('sessions', null, {});
    await queryInterface.bulkDelete('commissions', null, {});
    await queryInterface.bulkDelete('invoices', null, {});
    await queryInterface.bulkDelete('reviews', null, {});
    await queryInterface.bulkDelete('payments', null, {});
    await queryInterface.bulkDelete('job_logs', null, {});
  }
};
