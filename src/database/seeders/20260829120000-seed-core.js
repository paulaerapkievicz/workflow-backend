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

    // ---- Categorias/funções ---- ("Estoquista" nasce inativa: some das combos até a agência ativar)
    const categories = [
      ['Repositor', true], ['Operador de Caixa', true], ['Fiscal de Loja', true],
      ['Açougueiro', true], ['Padeiro', true], ['Estoquista', false],
    ].map(([name, active]) => ({ id: uid(), name, active, ...ts }));
    await queryInterface.bulkInsert('categories', categories);

    // ---- Usuários ----
    const adminUser = { id: uid(), name: 'Administrador', email: 'admin@email.com', password_hash: passwordHash, role: 'admin', phone: null, birth_date: null, ...ts };
    const superUser = { id: uid(), name: 'Dono do Supermercado', email: 'supermarket@email.com', password_hash: passwordHash, role: 'supermarket', phone: '(11) 90000-0001', birth_date: null, ...ts };
    const agencyUser = { id: uid(), name: 'Gerente da Agência', email: 'agency@email.com', password_hash: passwordHash, role: 'agency', phone: '(11) 90000-0002', birth_date: null, ...ts };
    const free1User = { id: uid(), name: 'Joana Freelancer', email: 'free1@email.com', password_hash: passwordHash, role: 'freelancer', phone: '(11) 90000-0003', birth_date: null, ...ts };
    const free2User = { id: uid(), name: 'Pedro Freelancer', email: 'free2@email.com', password_hash: passwordHash, role: 'freelancer', phone: '(11) 90000-0004', birth_date: null, ...ts };
    const leaderUser = { id: uid(), name: 'Lucas Líder', email: 'leader@email.com', password_hash: passwordHash, role: 'leader', phone: '(54) 90000-0005', birth_date: null, ...ts };
    await queryInterface.bulkInsert('users', [adminUser, superUser, agencyUser, free1User, free2User, leaderUser]);

    // ---- Agência ----
    // Vaga concluída (Padeiro, 4h): supermercado paga 33/h = 132 ; colaborador recebe 19/h = 76 ; agência 56.
    const agencyAmountPaid = 56.0;
    const freelancerAmountPaid = 76.0;
    const agency = { id: uid(), owner_id: agencyUser.id, name: 'Agência Prime', legal_name: 'Prime Serviços de Mão de Obra Ltda', cnpj: '55666777000181', address: 'Rua Dirceu Sander, 719, Passo Fundo RS', phone: '(54) 4000-0000', email: 'contato@agenciaprime.com.br', available_balance: agencyAmountPaid, commission_percentage: 15, checkin_radius: 300, cancellation_window_minutes: 30, checkin_early_tolerance_minutes: 30, require_checkout_photo: true, review_enabled: true, allow_self_registration: false, active: true, ...ts };
    await queryInterface.bulkInsert('agencies', [agency]);
    await queryInterface.bulkInsert('commissions', [{ id: uid(), agency_id: agency.id, percentage: 15, ...ts }]);

    // ---- Cargos configuráveis da equipe (tags) ----
    const teamRole = (scope, ownerId, name, position) => ({ id: uid(), scope, owner_id: ownerId, name, position, ...ts });
    const agencyRoles = ['Administrador', 'Gerente', 'RH', 'Operações', 'Comercial'].map((n, i) => teamRole('agency', agency.id, n, i));
    await queryInterface.bulkInsert('team_roles', agencyRoles);

    // ---- Supermercado (cliente da agência acima) + filiais ----
    const supermarket = { id: uid(), owner_id: superUser.id, agency_id: agency.id, name: 'Mercado Central', legal_name: 'Mercado Central Comércio de Alimentos Ltda', cnpj: '11222333000181', address: 'Rua Dirceu Sander, 719, Passo Fundo RS', phone: '(54) 3000-0000', email: 'contato@mercadocentral.com.br', ...ts };
    await queryInterface.bulkInsert('supermarkets', [supermarket]);
    const superRoles = ['Administrador', 'Gerente', 'RH', 'Financeiro', 'Comprador'].map((n, i) => teamRole('supermarket', supermarket.id, n, i));
    await queryInterface.bulkInsert('team_roles', superRoles);
    await queryInterface.bulkInsert('supermarket_members', [
      { id: uid(), supermarket_id: supermarket.id, user_id: superUser.id, can_submit_orders: true, can_approve_orders: true, can_view_invoices: true, can_pay_invoices: true, team_role_id: superRoles[0].id, is_owner: true, ...ts },
    ]);

    const branchCentro = { id: uid(), supermarket_id: supermarket.id, name: 'Filial Centro', address: 'Rua Dirceu Sander, 719, Passo Fundo RS', phone: '(54) 3000-0001', latitude: -28.269151, longitude: -52.374602, geocoded_at: now(), geocode_query: 'Rua Dirceu Sander, 719, Passo Fundo RS', service_status: 'approved', ...ts };
    const branchZonaSul = { id: uid(), supermarket_id: supermarket.id, name: 'Filial Zona Sul', address: 'Rua Uruguai, 1200 - Centro, Passo Fundo RS', phone: '(54) 3000-0002', latitude: -28.262500, longitude: -52.406800, geocoded_at: now(), geocode_query: 'Rua Uruguai, 1200 - Centro, Passo Fundo RS', service_status: 'approved', ...ts };
    await queryInterface.bulkInsert('branches', [branchCentro, branchZonaSul]);

    // ---- Valores/hora que a agência cobra do supermercado, por função ----
    const superRate = (catIndex, hourly, branchId = null) => ({
      id: uid(), supermarket_id: supermarket.id, category_id: categories[catIndex].id,
      branch_id: branchId, hourly_rate: hourly, active: true, ...ts,
    });
    await queryInterface.bulkInsert('supermarket_category_rates', [
      superRate(0, 30.0), // Repositor
      superRate(1, 32.0), // Operador de Caixa (padrão da rede)
      superRate(1, 30.0, branchZonaSul.id), // Operador de Caixa — tarifa específica da Zona Sul
      superRate(2, 34.0), // Fiscal de Loja
      superRate(3, 38.0), // Açougueiro
      superRate(4, 33.0), // Padeiro
    ]);

    // ---- Freelancers ----
    const free1 = { id: uid(), agency_id: agency.id, user_id: free1User.id, name: free1User.name, email: free1User.email, phone: free1User.phone, skills: 'Reposição, Organização de gôndolas', available_balance: 0, rating_count: 0, ...ts };
    const free2 = { id: uid(), agency_id: agency.id, user_id: free2User.id, name: free2User.name, email: free2User.email, phone: free2User.phone, skills: 'Caixa, Atendimento', available_balance: freelancerAmountPaid, rating_count: 0, ...ts };
    await queryInterface.bulkInsert('freelancers', [free1, free2]);

    // Funções que cada colaborador exerce + o valor/hora que ele recebe em cada uma.
    const freeCat = (freelancerId, catIndex, hourly) => ({
      id: uid(), freelancer_id: freelancerId, category_id: categories[catIndex].id, hourly_rate: hourly, ...ts,
    });
    await queryInterface.bulkInsert('freelancer_categories', [
      freeCat(free1.id, 0, 18.0), // Repositor
      freeCat(free1.id, 1, 20.0), // Operador de Caixa
      freeCat(free1.id, 4, 19.0), // Padeiro
      freeCat(free2.id, 1, 20.0), // Operador de Caixa
      freeCat(free2.id, 2, 21.0), // Fiscal de Loja (vaga em andamento do seed)
      freeCat(free2.id, 4, 19.0), // Padeiro (vaga concluída do seed)
    ]);

    // ---- Líder da agência (escopo: Filial Centro + Joana) ----
    const leaderMember = {
      id: uid(), agency_id: agency.id, user_id: leaderUser.id, active: true,
      pay_type: 'mensal', pay_amount: 2500.0, available_balance: 0, team_role_id: agencyRoles[1].id, ...ts,
    };
    await queryInterface.bulkInsert('agency_members', [leaderMember]);
    await queryInterface.bulkInsert('agency_member_freelancers', [
      { id: uid(), agency_member_id: leaderMember.id, freelancer_id: free1.id, ...ts },
    ]);
    await queryInterface.bulkInsert('agency_member_branches', [
      { id: uid(), agency_member_id: leaderMember.id, branch_id: branchCentro.id, ...ts },
    ]);

    // ---- Onboarding concluído do Pedro (free2) — pronto para assinar o contrato ----
    // (free1 é usado no fluxo que testa a trava de onboarding, então fica sem contrato no seed.)
    await queryInterface.bulkUpdate('freelancers', { onboarding_approved_at: now() }, { id: free2.id });
    await queryInterface.bulkInsert('freelancer_contracts', [{
      id: uid(), freelancer_id: free2.id,
      full_name: 'Pedro Henrique Freelancer', cpf: '987.654.321-00', rg: '7654321', rg_issuer: 'SSP/RS',
      pis_nis: '210.98765.43-2', birth_date: '1990-11-03', gender: 'Masculino', marital_status: 'Casado',
      nationality: 'Brasileira', mother_name: 'Ana Freelancer', father_name: 'Carlos Freelancer',
      education_level: 'Ensino médio completo', ctps_number: '7654321', ctps_series: '0002-RS',
      address_cep: '99020-200', address_street: 'Rua Morom', address_number: '120', address_complement: 'Casa',
      address_neighborhood: 'Vila Rodrigues', address_city: 'Passo Fundo', address_state: 'RS',
      bank_name: 'Caixa Econômica', bank_branch: '0987-6', bank_account: '54321-0', bank_account_type: 'Poupança',
      pix_key: 'free2@email.com', emergency_contact_name: 'Ana Freelancer', emergency_contact_phone: '(54) 99999-1111',
      shirt_size: 'G', completed_at: now(), ...ts,
    }]);

    // ---- Modelo de contrato ativo da agência ----
    const contractTemplate = {
      id: uid(), agency_id: agency.id, title: 'Contrato de Prestação de Serviços', active: true,
      created_by: agencyUser.id,
      body_html:
        '<h1>Contrato de Prestação de Serviços</h1>'
        + '<p>Pelo presente instrumento, de um lado <strong>{{agencyLegalName}}</strong>, inscrita no CNPJ '
        + 'sob o nº {{agencyCnpj}}, com sede em {{agencyAddress}}, doravante denominada CONTRATANTE, e de outro '
        + 'lado <strong>{{fullName}}</strong>, portador(a) do CPF {{cpf}} e do RG {{rg}}, residente em '
        + '{{address}}, doravante denominado(a) PRESTADOR(A).</p>'
        + '<h2>1. Do objeto</h2><p>O(a) PRESTADOR(A) executará serviços de reposição e atendimento nas lojas '
        + 'clientes da CONTRATANTE, conforme as convocações aceitas na plataforma.</p>'
        + '<h2>2. Dos dados bancários</h2><p>Os pagamentos serão feitos na conta {{bankAccount}}, agência '
        + '{{bankBranch}}, do {{bankName}}, ou via chave Pix {{pixKey}}.</p>'
        + '<h2>3. Do contato de emergência</h2><p>{{emergencyContactName}} — {{emergencyContactPhone}}.</p>'
        + '<p>{{dataPorExtenso}}.</p>',
      ...ts,
    };
    await queryInterface.bulkInsert('contract_templates', [contractTemplate]);

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
    const jobCompleted = baseJob({ title: 'Padeiro - Filial Centro', category_id: categories[4].id, freelancer_id: free2.id, status: 'completed', agency_review_enabled: true, start_time: hoursFromNow(-30), end_time: hoursFromNow(-26), payment_amount: 132.0, gross_amount: 132.0, shift_period: 'madrugada', contracted_minutes: 240, worked_minutes: 240, completed_at: hoursFromNow(-26), settlement_approved_at: hoursFromNow(-26) });

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
    const gross = 132.0;
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
      'freelancer_locations', 'jobs', 'order_items', 'orders', 'supermarket_category_rates',
      'freelancer_contract_signatures', 'contract_templates',
      'agency_member_payments', 'agency_member_freelancers', 'agency_member_branches', 'agency_members',
      'freelancer_categories', 'freelancer_contracts', 'reviews', 'commissions', 'supermarket_member_branches', 'supermarket_members',
      'freelancers', 'branches', 'team_roles', 'supermarkets', 'agencies', 'categories', 'sessions', 'users',
    ]) {
      await queryInterface.bulkDelete(table, null, {});
    }
  },
};
