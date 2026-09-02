'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const uid = () => crypto.randomUUID();
const now = () => new Date();
const hoursFromNow = (h) => new Date(Date.now() + h * 60 * 60 * 1000);
// data-base "amanhã" às HH:MM
const at = (dayOffset, hh, mm) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d;
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const passwordHash = await bcrypt.hash('123456', 10);
    const ts = { created_at: now(), updated_at: now() };

    // ---- Categorias ----
    const categories = ['Repositor', 'Operador de Caixa', 'Fiscal de Loja', 'Açougueiro', 'Padeiro']
      .map((name) => ({ id: uid(), name, ...ts }));
    await queryInterface.bulkInsert('categories', categories);

    // ---- Usuários ----
    const adminUser = { id: uid(), name: 'Administrador', email: 'admin@email.com', password_hash: passwordHash, role: 'admin', phone: null, birth_date: null, ...ts };
    const superUser = { id: uid(), name: 'Dono do Supermercado', email: 'supermarket@email.com', password_hash: passwordHash, role: 'supermarket', phone: '(11) 90000-0001', birth_date: null, ...ts };
    const agencyUser = { id: uid(), name: 'Gerente da Agência', email: 'agency@email.com', password_hash: passwordHash, role: 'agency', phone: '(11) 90000-0002', birth_date: null, ...ts };
    const free1User = { id: uid(), name: 'Joana Freelancer', email: 'free1@email.com', password_hash: passwordHash, role: 'freelancer', phone: '(11) 90000-0003', birth_date: null, ...ts };
    const free2User = { id: uid(), name: 'Pedro Freelancer', email: 'free2@email.com', password_hash: passwordHash, role: 'freelancer', phone: '(11) 90000-0004', birth_date: null, ...ts };
    await queryInterface.bulkInsert('users', [adminUser, superUser, agencyUser, free1User, free2User]);

    // ---- Supermercado + filiais ----
    const supermarket = { id: uid(), owner_id: superUser.id, name: 'Mercado Central', cnpj: '11222333000144', address: 'Av. Principal, 1000 - São Paulo/SP', phone: '(11) 3000-0000', ...ts };
    await queryInterface.bulkInsert('supermarkets', [supermarket]);
    await queryInterface.bulkInsert('supermarket_members', [
      { id: uid(), supermarket_id: supermarket.id, user_id: superUser.id, branch_id: null, can_submit_orders: true, can_approve_orders: true, is_owner: true, ...ts },
    ]);

    const branchCentro = { id: uid(), supermarket_id: supermarket.id, name: 'Filial Centro', address: 'Rua do Centro, 50 - Centro, São Paulo/SP', phone: '(11) 3000-0001', latitude: -23.550520, longitude: -46.633308, geocoded_at: now(), geocode_query: 'Rua do Centro, 50 - Centro, São Paulo/SP', ...ts };
    const branchZonaSul = { id: uid(), supermarket_id: supermarket.id, name: 'Filial Zona Sul', address: 'Av. Sul, 2500 - Santo Amaro, São Paulo/SP', phone: '(11) 3000-0002', latitude: -23.650000, longitude: -46.700000, geocoded_at: now(), geocode_query: 'Av. Sul, 2500 - Santo Amaro, São Paulo/SP', ...ts };
    await queryInterface.bulkInsert('branches', [branchCentro, branchZonaSul]);

    // ---- Agência + comissão ----
    const agencyAmountPaid = 27.0; // 15% de 180 da vaga concluída
    const freelancerAmountPaid = 153.0;
    const agency = { id: uid(), owner_id: agencyUser.id, name: 'Agência Prime', cnpj: '55666777000188', address: 'Rua das Agências, 300', phone: '(11) 4000-0000', available_balance: agencyAmountPaid, commission_percentage: 15, checkin_radius: 300, cancellation_window_minutes: 30, require_checkout_photo: true, review_enabled: true, allow_self_registration: true, ...ts };
    await queryInterface.bulkInsert('agencies', [agency]);
    await queryInterface.bulkInsert('commissions', [{ id: uid(), agency_id: agency.id, percentage: 15, ...ts }]);

    // ---- Tabela de valor/hora da agência por função ----
    const rate = (catIndex, hourly) => ({ id: uid(), agency_id: agency.id, category_id: categories[catIndex].id, hourly_rate: hourly, active: true, ...ts });
    await queryInterface.bulkInsert('agency_category_rates', [
      rate(0, 22.0), // Repositor
      rate(1, 24.0), // Operador de Caixa
      rate(2, 26.0), // Fiscal de Loja
      rate(3, 28.0), // Açougueiro
      rate(4, 25.0), // Padeiro
    ]);

    // ---- Freelancers ----
    const free1 = { id: uid(), agency_id: agency.id, user_id: free1User.id, name: free1User.name, email: free1User.email, phone: free1User.phone, skills: 'Reposição, Organização de gôndolas', available_balance: 0, rating_count: 0, ...ts };
    const free2 = { id: uid(), agency_id: agency.id, user_id: free2User.id, name: free2User.name, email: free2User.email, phone: free2User.phone, skills: 'Caixa, Atendimento', available_balance: freelancerAmountPaid, rating_count: 0, ...ts };
    await queryInterface.bulkInsert('freelancers', [free1, free2]);

    // free1 exerce várias funções (repositor/caixa/padeiro); free2 é caixa.
    await queryInterface.bulkInsert('freelancer_categories', [
      { id: uid(), freelancer_id: free1.id, category_id: categories[0].id, ...ts },
      { id: uid(), freelancer_id: free1.id, category_id: categories[1].id, ...ts },
      { id: uid(), freelancer_id: free1.id, category_id: categories[4].id, ...ts },
      { id: uid(), freelancer_id: free2.id, category_id: categories[1].id, ...ts },
    ]);

    // ---- Vagas ----
    const baseJob = (over) => ({
      id: uid(),
      supermarket_id: supermarket.id,
      branch_id: branchCentro.id,
      category_id: categories[0].id,
      freelancer_id: null,
      description: 'Trabalho de reposição e organização de loja.',
      payment_amount: 180.0,
      status: 'pending',
      photos_required: true,
      agency_review_enabled: false,
      start_time: at(1, 8, 0),
      end_time: at(1, 18, 0),
      ...ts,
      ...over,
    });

    const jobDoisTurnos = baseJob({ title: 'Repositor - Filial Centro', start_time: at(1, 6, 0), end_time: at(1, 12, 0), payment_amount: null, shift_period: 'manha', contracted_minutes: 360 });
    const jobPendingB = baseJob({ title: 'Operador de Caixa - Filial Zona Sul', branch_id: branchZonaSul.id, category_id: categories[1].id, start_time: at(1, 12, 0), end_time: at(1, 18, 0), payment_amount: null, shift_period: 'tarde', contracted_minutes: 360 });
    const jobAccepted = baseJob({ title: 'Repositor - Filial Centro', freelancer_id: free1.id, status: 'accepted', start_time: at(1, 18, 0), end_time: at(1, 24, 0), payment_amount: null, shift_period: 'noite', contracted_minutes: 360 });
    const jobInProgress = baseJob({ title: 'Fiscal de Loja - Filial Centro', category_id: categories[2].id, freelancer_id: free2.id, status: 'in_progress', start_time: hoursFromNow(-1), end_time: hoursFromNow(3), payment_amount: null, shift_period: 'tarde', contracted_minutes: 240 });
    const jobCompleted = baseJob({ title: 'Padeiro - Filial Centro', category_id: categories[4].id, freelancer_id: free2.id, status: 'completed', agency_review_enabled: true, start_time: hoursFromNow(-30), end_time: hoursFromNow(-26), payment_amount: 180.0, gross_amount: 180.0, shift_period: 'madrugada', contracted_minutes: 240, worked_minutes: 240, completed_at: hoursFromNow(-26) });

    await queryInterface.bulkInsert('jobs', [jobDoisTurnos, jobPendingB, jobAccepted, jobInProgress, jobCompleted]);

    // ---- Turnos ----
    const shift = (job, pos, s, e, label, over = {}) => ({ id: uid(), job_id: job.id, position: pos, start_time: s, end_time: e, label, status: 'pending', ...ts, ...over });
    await queryInterface.bulkInsert('job_shifts', [
      shift(jobDoisTurnos, 0, at(1, 6, 0), at(1, 12, 0), 'Manhã'),
      shift(jobPendingB, 0, at(1, 12, 0), at(1, 18, 0), 'Tarde'),
      shift(jobAccepted, 0, at(1, 18, 0), at(1, 24, 0), 'Noite'),
      shift(jobInProgress, 0, hoursFromNow(-1), hoursFromNow(3), 'Tarde', { status: 'in_progress', check_in_at: hoursFromNow(-1) }),
      shift(jobCompleted, 0, hoursFromNow(-30), hoursFromNow(-26), 'Madrugada', { status: 'done', check_in_at: hoursFromNow(-30), check_out_at: hoursFromNow(-26), worked_minutes: 240 }),
    ]);

    // ---- Logs de jornada ----
    await queryInterface.bulkInsert('job_logs', [
      { id: uid(), job_id: jobInProgress.id, freelancer_id: free2.id, event_type: 'check-in', reason: null, timestamp: hoursFromNow(-1), latitude: -23.550520, longitude: -46.633308, ...ts },
      { id: uid(), job_id: jobCompleted.id, freelancer_id: free2.id, event_type: 'check-in', reason: null, timestamp: hoursFromNow(-30), latitude: -23.550520, longitude: -46.633308, ...ts },
      { id: uid(), job_id: jobCompleted.id, freelancer_id: free2.id, event_type: 'check-out', reason: null, timestamp: hoursFromNow(-26), latitude: -23.550520, longitude: -46.633308, ...ts },
    ]);

    // ---- Foto de comprovação da vaga concluída ----
    await queryInterface.bulkInsert('job_photos', [
      { id: uid(), job_id: jobCompleted.id, freelancer_id: free2.id, job_log_id: null, url: '/uploads/exemplo-comprovacao.svg', caption: 'Gôndola reabastecida', ...ts },
    ]);

    // ---- Pagamento (liberado) + fatura pendente da vaga concluída ----
    const gross = 180.0;
    const payment = {
      id: uid(),
      job_id: jobCompleted.id,
      freelancer_id: free2.id,
      amount: gross,
      gross_amount: gross,
      agency_amount: agencyAmountPaid,
      freelancer_amount: freelancerAmountPaid,
      status: 'settled',
      paid_at: hoursFromNow(-26),
      released_at: hoursFromNow(-26),
      ...ts,
    };
    await queryInterface.bulkInsert('payments', [payment]);

    await queryInterface.bulkInsert('invoices', [
      { id: uid(), supermarket_id: supermarket.id, job_id: jobCompleted.id, payment_id: payment.id, total_amount: gross, status: 'pending', ...ts },
    ]);
  },

  async down(queryInterface) {
    for (const table of [
      'withdrawals', 'job_photos', 'invoices', 'payments', 'job_logs', 'job_shifts',
      'freelancer_locations', 'jobs', 'order_items', 'orders', 'agency_category_rates',
      'freelancer_categories', 'reviews', 'commissions', 'supermarket_members',
      'freelancers', 'branches', 'agencies', 'supermarkets', 'categories', 'sessions', 'users',
    ]) {
      await queryInterface.bulkDelete(table, null, {});
    }
  },
};
