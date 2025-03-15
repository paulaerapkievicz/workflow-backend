const { v4: uuidv4 } = require('uuid');
const { Sequelize, QueryInterface } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Criando usuários
    const users = [
      { id: uuidv4(), name: 'Admin', email: 'admin@example.com', password_hash: 'hash', role: 'admin', created_at: new Date(), updated_at: new Date() },
      { id: uuidv4(), name: 'User', email: 'user@example.com', password_hash: 'hash', role: 'agency', created_at: new Date(), updated_at: new Date() }
    ];
    await queryInterface.bulkInsert('users', users);

    // Criando supermercados
    const supermarkets = [
      { id: uuidv4(), owner_id: users[0].id, name: 'Supermarket 1', cnpj: '12345678000100', address: 'Rua 1', phone: '1111-1111', created_at: new Date(), updated_at: new Date() }
    ];
    await queryInterface.bulkInsert('supermarkets', supermarkets);

    // Criando filiais
    const branches = [
      { id: uuidv4(), supermarket_id: supermarkets[0].id, name: 'Branch 1', address: 'Rua 2', phone: '2222-2222', created_at: new Date(), updated_at: new Date() }
    ];
    await queryInterface.bulkInsert('branches', branches);

    // Criando agências
    const agencies = [
      { id: uuidv4(), owner_id: users[1].id, name: 'Agency 1', cnpj: '22345678000100', address: 'Rua 3', phone: '3333-3333', created_at: new Date(), updated_at: new Date() }
    ];
    await queryInterface.bulkInsert('agencies', agencies);

    // Criando freelancers
    const freelancers = [
      { id: uuidv4(), agency_id: agencies[0].id, name: 'Freelancer 1', email: 'freelancer1@example.com', phone: '4444-4444', skills: 'Skill A, Skill B', created_at: new Date(), updated_at: new Date() }
    ];
    await queryInterface.bulkInsert('freelancers', freelancers);

    // Criando categorias
    const categories = [
      { id: uuidv4(), name: 'Category 1', created_at: new Date(), updated_at: new Date() }
    ];
    await queryInterface.bulkInsert('categories', categories);

    // Associando freelancers a categorias
    const freelancerCategories = [
      { id: uuidv4(), freelancer_id: freelancers[0].id, category_id: categories[0].id, created_at: new Date(), updated_at: new Date() }
    ];
    await queryInterface.bulkInsert('freelancer_categories', freelancerCategories);

    // Criando jobs
    const jobs = [
      { id: uuidv4(), supermarket_id: supermarkets[0].id, branch_id: branches[0].id, category_id: categories[0].id, freelancer_id: freelancers[0].id, status: 'pending', start_time: new Date(), end_time: new Date(), payment_amount: 100.00, created_at: new Date(), updated_at: new Date() }
    ];
    await queryInterface.bulkInsert('jobs', jobs);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('jobs', null, {});
    await queryInterface.bulkDelete('freelancer_categories', null, {});
    await queryInterface.bulkDelete('categories', null, {});
    await queryInterface.bulkDelete('freelancers', null, {});
    await queryInterface.bulkDelete('agencies', null, {});
    await queryInterface.bulkDelete('branches', null, {});
    await queryInterface.bulkDelete('supermarkets', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};
