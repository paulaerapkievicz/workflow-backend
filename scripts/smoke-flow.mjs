/**
 * Teste de fluxo ponta a ponta (Bloco C). Requer o servidor rodando em BASE_URL
 * e o banco de teste seedado.
 *
 *   NODE_ENV=test PORT=3334 npx ts-node-dev --transpile-only src/server.ts   (noutro terminal)
 *   node scripts/smoke-flow.mjs
 */
import pg from 'pg'
import crypto from 'crypto'
import 'dotenv/config'

const BASE = process.env.BASE_URL || 'http://localhost:3334'
const CENTRO = { latitude: -28.269151, longitude: -52.374602 } // = Filial Centro no seed (Rua Dirceu Sander, 719, Passo Fundo RS)
const FAR = { latitude: -28.32, longitude: -52.44 } // ~8 km da Filial Centro
const TEST_ADDRESS = 'Rua Dirceu Sander, 719, Passo Fundo RS'

let pass = 0
let fail = 0
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ok  ${label}`) }
  else { fail++; console.error(`  X   ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`) }
}
const section = (t) => console.log(`\n== ${t}`)

async function req(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { /* vazio */ }
  return { status: res.status, data }
}

const login = async (email) => {
  const { status, data } = await req('POST', '/auth/login', { body: { email, password: '123456' } })
  if (status !== 200) throw new Error(`login ${email}: ${status} ${JSON.stringify(data)}`)
  return data.token
}

const db = new pg.Client({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME_TEST || 'workflow_db_test',
})

const yyyymm = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const dateInDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

// Geradores de documento válido — os cadastros agora validam CPF/CNPJ (helpers/validation.ts).
const mod11Dv = (nums, weights) => {
  const sum = nums.reduce((s, n, i) => s + n * weights[i], 0)
  const r = sum % 11
  return r < 2 ? 0 : 11 - r
}
const validCnpj = () => {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10))
  const d1 = mod11Dv(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const d2 = mod11Dv([...base, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return [...base, d1, d2].join('')
}
const validCpf = () => {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  const dv = (nums, start) => {
    let sum = 0
    let f = start
    for (const n of nums) sum += n * f--
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  const d1 = dv(base, 10)
  const d2 = dv([...base, d1], 11)
  return [...base, d1, d2].join('')
}

// Traz o próximo turno pendente da vaga para "agora" — as vagas de teste são criadas para
// amanhã, mas o check-in real só é aceito perto do horário do turno (tolerância de 30 min).
const startShiftNow = (jobId) =>
  db.query(
    `UPDATE job_shifts SET start_time = NOW() - interval '5 minutes',
       end_time = GREATEST(end_time, NOW() + interval '30 minutes')
     WHERE job_id = $1 AND status = 'pending'
       AND position = (SELECT MIN(position) FROM job_shifts WHERE job_id = $1 AND status = 'pending')`,
    [jobId]
  )

async function main() {
  await db.connect()

  section('Login')
  const superT = await login('supermarket@email.com')
  const agencyT = await login('agency@email.com')
  const freeT = await login('free1@email.com')
  ok(!!superT && !!agencyT && !!freeT, 'tokens obtidos')

  const meSuper = (await req('GET', '/auth/me', { token: superT })).data
  const meAgency = (await req('GET', '/auth/me', { token: agencyT })).data
  const meFree = (await req('GET', '/auth/me', { token: freeT })).data
  const supermarketId = meSuper.profile.id
  const agencyId = meAgency.profile.id
  const freelancerId = meFree.profile.id
  ok(!!meFree.profile.affiliatedAgency, 'perfil do freelancer traz a agência (prazo de cancelamento)')

  section('Configurações da agência')
  let settings = (await req('GET', '/agency/settings', { token: agencyT })).data
  ok(settings.checkinRadius === 300 && settings.cancellationWindowMinutes === 30, 'settings padrão', settings)
  ok(settings.checkinEarlyToleranceMinutes === 30, 'antecedência de check-in padrão = 30 min', settings.checkinEarlyToleranceMinutes)
  const upd = await req('PUT', '/agency/settings', { token: agencyT, body: { checkinRadius: 250, cancellationWindowMinutes: 45, checkinEarlyToleranceMinutes: 15 } })
  ok(
    upd.status === 200 && upd.data.checkinRadius === 250 && upd.data.cancellationWindowMinutes === 45 && upd.data.checkinEarlyToleranceMinutes === 15,
    'settings atualizadas (incl. antecedência do check-in)'
  )
  const badTol = await req('PUT', '/agency/settings', { token: agencyT, body: { checkinEarlyToleranceMinutes: 999 } })
  ok(badTol.status === 400, 'antecedência de check-in fora da faixa (0–240) é recusada', badTol.data?.message)
  await req('PUT', '/agency/settings', { token: agencyT, body: { checkinRadius: 300, cancellationWindowMinutes: 30, checkinEarlyToleranceMinutes: 30, requireCheckoutPhoto: true } })

  section('Marcações de vaga sem colaborador (faixas configuráveis)')
  ok(Array.isArray(settings.unfilledAlertTiers) && settings.unfilledAlertTiers.length === 3, 'faixas padrão vêm no settings', settings.unfilledAlertTiers?.length)
  const tiersUpd = await req('PUT', '/agency/settings', {
    token: agencyT,
    body: {
      unfilledAlertTiers: [
        { id: 'a', minutesBefore: 9999, color: 'roxo', label: 'inválida' }, // descartada (minutos + cor)
        { id: 'b', minutesBefore: 45, color: '#00AA00', label: 'Falta 45 min', blink: true },
        { id: 'c', minutesBefore: 0, color: '#F00', label: '', blink: false }, // #RGB ok, label auto
      ],
    },
  })
  ok(tiersUpd.status === 200, 'PUT settings com faixas 200')
  const savedTiers = tiersUpd.data.unfilledAlertTiers
  ok(savedTiers.length === 2, 'faixa inválida (minutos/cor) descartada', savedTiers.map((t) => t.minutesBefore))
  ok(savedTiers[0].minutesBefore === 45 && savedTiers[1].minutesBefore === 0, 'faixas ordenadas da mais distante para a mais urgente', savedTiers.map((t) => t.minutesBefore))
  ok(savedTiers[1].label === '0 min', 'rótulo vazio ganha fallback', savedTiers[1].label)
  await req('PUT', '/agency/settings', { token: agencyT, body: { unfilledAlertTiers: settings.unfilledAlertTiers } })

  section('Cores personalizáveis das tags de status')
  ok(settings.statusColors && settings.statusColors.pending && settings.statusColors.done.bg,
    'paleta padrão dos 6 tons vem no settings', Object.keys(settings.statusColors || {}))
  const colorsUpd = await req('PUT', '/agency/settings', {
    token: agencyT,
    body: {
      statusColors: {
        pending: { bg: '#123456', fg: 'nao-e-hex' }, // fg inválido -> mantém o padrão
        done: { bg: '#0a0', fg: '#fff' },
        lixo: { bg: '#000', fg: '#000' }, // tom desconhecido -> ignorado
      },
    },
  })
  ok(colorsUpd.status === 200 && colorsUpd.data.statusColors.pending.bg === '#123456',
    'cor de fundo válida é salva', colorsUpd.data?.statusColors?.pending)
  ok(colorsUpd.data.statusColors.pending.fg === settings.statusColors.pending.fg,
    'cor inválida (não-hex) volta para o padrão', colorsUpd.data?.statusColors?.pending?.fg)
  ok(!('lixo' in colorsUpd.data.statusColors), 'tom desconhecido é ignorado')
  const meSuperColors = (await req('GET', '/auth/me', { token: superT })).data
  ok(meSuperColors.profile?.clientAgency?.statusColors?.done?.bg === '#0a0',
    'supermercado-cliente recebe a paleta da agência no /auth/me', meSuperColors.profile?.clientAgency?.statusColors?.done)
  await req('PUT', '/agency/settings', { token: agencyT, body: { statusColors: settings.statusColors } })

  section('Funções: flag ativa + gestão pela agência')
  const publicCats = (await req('GET', '/categories', { token: agencyT })).data
  const manageCats = (await req('GET', '/categories/manage', { token: agencyT })).data
  ok(!publicCats.some((c) => c.name === 'Estoquista'), 'função inativa não aparece em GET /categories', publicCats.map((c) => c.name))
  ok(manageCats.some((c) => c.name === 'Estoquista' && c.active === false), 'função inativa aparece em /categories/manage com active=false')
  const estoquista = manageCats.find((c) => c.name === 'Estoquista')
  const activated = await req('PUT', `/categories/${estoquista.id}`, { token: agencyT, body: { active: true, name: 'Estoquista Sênior' } })
  ok(activated.status === 200 && activated.data.active === true && activated.data.name === 'Estoquista Sênior', 'agência ativa e renomeia a função')
  ok((await req('GET', '/categories', { token: agencyT })).data.some((c) => c.name === 'Estoquista Sênior'), 'função ativada passa a aparecer na combo')
  const dupCat = await req('POST', '/categories', { token: agencyT, body: { name: 'Repositor' } })
  ok(dupCat.status === 400, 'nome de função duplicado é recusado', dupCat.data?.message)
  const newCat = await req('POST', '/categories', { token: agencyT, body: { name: `Empacotador ${Date.now()}` } })
  ok(newCat.status === 201, 'agência cria nova função')
  ok((await req('DELETE', `/categories/${newCat.data.id}`, { token: agencyT })).status === 200, 'função sem uso pode ser excluída')
  const repInUse = (await req('GET', '/categories', { token: agencyT })).data.find((c) => c.name === 'Repositor')
  const delInUse = await req('DELETE', `/categories/${repInUse.id}`, { token: agencyT })
  ok(delInUse.status === 400 && /uso/i.test(delInUse.data?.message || ''), 'função em uso não pode ser excluída (desative)', delInUse.data?.message)
  await req('PUT', `/categories/${estoquista.id}`, { token: agencyT, body: { active: false, name: 'Estoquista' } })

  section('Valores/hora do supermercado')
  const cats = (await req('GET', '/categories', { token: superT })).data
  const catCaixa = cats.find((c) => c.name === 'Operador de Caixa')
  const catRepositor = cats.find((c) => c.name === 'Repositor')
  const catPadeiro = cats.find((c) => c.name === 'Padeiro')
  const rates = (await req('GET', `/supermarkets/${supermarketId}/rates`, { token: agencyT })).data
  const rateCaixa = rates.find((r) => r.categoryId === catCaixa.id && !r.branchId)
  ok(Number(rateCaixa.hourlyRate) === 32, 'valor/hora Operador de Caixa (padrão) = 32', rateCaixa?.hourlyRate)
  const branchesForRate = (await req('GET', '/branches', { token: superT })).data
  const branchSulForRate = branchesForRate.find((b) => b.name === 'Filial Zona Sul')
  const rateCaixaSul = rates.find((r) => r.categoryId === catCaixa.id && r.branchId === branchSulForRate.id)
  ok(rateCaixaSul && Number(rateCaixaSul.hourlyRate) === 30, 'override da filial (Zona Sul) = 30 e vence o padrão da matriz', rateCaixaSul?.hourlyRate)
  const ratePadeiro = rates.find((r) => r.categoryId === catPadeiro.id && !r.branchId)
  // O valor/hora do Padeiro só é removido DEPOIS do pedido criado (mais abaixo) — a criação
  // do pedido agora exige valor/hora configurado pra cada função (orderService.normalizeItems).

  // Item 1: função do colaborador não pode ser salva sem valor/hora.
  const catFiscal = cats.find((c) => c.name === 'Fiscal de Loja') // função que o seed NÃO dá à Joana
  const noRateCat = await req('POST', `/freelancers/${freelancerId}/categories`, { token: agencyT, body: { categoryId: catFiscal.id } })
  ok(noRateCat.status === 400 && /valor\/hora/i.test(noRateCat.data?.message || ''), 'função do colaborador sem valor/hora é recusada com mensagem clara', noRateCat.data?.message)
  const withRateCat = await req('POST', `/freelancers/${freelancerId}/categories`, { token: agencyT, body: { categoryId: catFiscal.id, hourlyRate: 21 } })
  ok(withRateCat.status === 201, 'função do colaborador com valor/hora é aceita', withRateCat.data)
  // restaura o estado do seed (Joana não exerce Fiscal de Loja) pra não afetar asserções adiante
  await req('DELETE', `/freelancers/${freelancerId}/categories/${catFiscal.id}`, { token: agencyT })

  section('Supermercado cria pedido (turno = dropdown)')
  const branches = (await req('GET', '/branches', { token: superT })).data
  const branchCentro = branches.find((b) => b.name === 'Filial Centro')
  const branchSul = branches.find((b) => b.name === 'Filial Zona Sul')
  const day = dateInDays(1)

  const orderRes = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [
        { categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 3, shiftPeriod: 'manha', date: day },
        { categoryId: catRepositor.id, branchId: branchCentro.id, quantity: 2, shiftPeriod: 'tarde', date: day, startTime: '13:00', endTime: '17:00' },
        { categoryId: catPadeiro.id, branchId: branchSul.id, quantity: 1, shiftPeriod: 'madrugada', date: day },
      ],
    },
  })
  ok(orderRes.status === 201, 'POST /orders 201', orderRes.status === 201 ? undefined : orderRes.data)
  const order = orderRes.data
  ok(order.orderJobs.length === 6, 'pedido gerou 6 vagas', order.orderJobs?.length)
  ok(
    new Set(order.orderJobs.map((j) => j.branchId)).size === 2,
    'pedido pode ter vagas em filiais diferentes',
    [...new Set(order.orderJobs.map((j) => j.branchId))].length
  )
  const caixaJobs = order.orderJobs.filter((j) => j.categoryId === catCaixa.id)
  ok(caixaJobs.length === 3, '3 vagas de Operador de Caixa', caixaJobs.length)
  ok(caixaJobs[0].title === 'Operador de Caixa - Filial Centro (1/3)', 'título padrão = função + filial', caixaJobs[0].title)
  ok(caixaJobs[0].shiftPeriod === 'manha', 'vaga guarda o turno', caixaJobs[0].shiftPeriod)
  const repJob = order.orderJobs.find((j) => j.categoryId === catRepositor.id)
  ok(repJob.contractedMinutes === 240, 'Repositor 13–17 = 240 min', repJob.contractedMinutes)

  section('Adicionar vagas a um pedido já enviado')
  const added = await req('POST', `/orders/${order.id}/items`, {
    token: superT,
    body: {
      items: [
        { categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, shiftPeriod: 'tarde', date: day },
        { categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, shiftPeriod: 'manha', date: day },
      ],
    },
  })
  ok(added.status === 201 && added.data.orderJobs.length === 8, '2 vagas adicionadas (6 -> 8)', added.data?.orderJobs?.length)

  section('Gerente de loja + aprovação de pedido')
  const mgrEmail = `gerente-sul-${Date.now()}@email.com`
  const mkMember = await req('POST', `/supermarkets/${supermarketId}/members`, {
    token: superT,
    body: { name: 'Gerente Zona Sul', email: mgrEmail, password: '123456', branchIds: [branchSul.id], canApproveOrders: false },
  })
  ok(mkMember.status === 201, 'dono cadastra gerente de loja')
  const mgrListed = (await req('GET', `/supermarkets/${supermarketId}/members`, { token: superT })).data.find((m) => m.id === mkMember.data.id)
  ok(mgrListed && mgrListed.branchIds.length === 1 && mgrListed.branchIds[0] === branchSul.id, 'gerente com escopo de 1 filial (via branchIds)', mgrListed?.branchIds)
  const mgrT = await login(mgrEmail)
  const mgrOrder = await req('POST', '/orders', {
    token: mgrT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 2, shiftPeriod: 'tarde', date: day }] },
  })
  ok(mgrOrder.status === 201 && mgrOrder.data.approvalStatus === 'pending_approval', 'pedido do gerente fica aguardando aprovação')
  ok(mgrOrder.data.orderJobs.every((j) => j.status === 'awaiting_approval'), 'vagas nascem awaiting_approval')
  ok(mgrOrder.data.orderJobs.every((j) => j.branchId === branchSul.id), 'gerente de loja força a filial dele', mgrOrder.data.orderJobs[0]?.branchId)
  const availBefore = (await req('GET', '/jobs/available', { token: freeT })).data
  ok(!availBefore.some((j) => j.orderId === mgrOrder.data.id), 'vaga aguardando aprovação não aparece para o freelancer')
  const appr = await req('POST', `/orders/${mgrOrder.data.id}/approve`, { token: superT })
  ok(appr.status === 200 && appr.data.approvalStatus === 'approved', 'dono aprova o pedido')
  ok(appr.data.orderJobs.every((j) => j.status === 'pending'), 'vagas aprovadas entram como pending')
  const mgrOrder2 = await req('POST', '/orders', {
    token: mgrT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchSul.id, quantity: 1, shiftPeriod: 'manha', date: day }] },
  })
  const rej = await req('POST', `/orders/${mgrOrder2.data.id}/reject`, { token: superT, body: { reason: 'fora do orçamento' } })
  ok(rej.status === 200 && rej.data.approvalStatus === 'rejected', 'dono recusa o pedido')
  ok(rej.data.orderJobs.every((j) => j.status === 'canceled'), 'vagas do pedido recusado são canceladas')

  section('Gerente responsável por várias filiais')
  const toMulti = await req('PUT', `/supermarket-members/${mkMember.data.id}`, {
    token: superT, body: { branchIds: [branchSul.id, branchCentro.id] },
  })
  ok(toMulti.status === 200, 'dono amplia o escopo do gerente para 2 filiais')
  const multiListed = (await req('GET', `/supermarkets/${supermarketId}/members`, { token: superT })).data.find((m) => m.id === mkMember.data.id)
  ok(multiListed && multiListed.branchIds.length === 2, 'gerente agora cobre 2 filiais', multiListed?.branchIds?.length)
  const multiOrder = await req('POST', '/orders', {
    token: mgrT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, shiftPeriod: 'tarde', date: day }] },
  })
  ok(multiOrder.status === 201 && multiOrder.data.orderJobs.every((j) => j.branchId === branchCentro.id),
    'gerente multi-filial escolhe a filial da vaga (não é forçada)', multiOrder.data?.orderJobs?.[0]?.branchId)
  await req('POST', `/orders/${multiOrder.data.id}/reject`, { token: superT, body: { reason: 'teste' } })
  const noBranch = await req('POST', '/orders', {
    token: mgrT,
    body: { items: [{ categoryId: catCaixa.id, quantity: 1, shiftPeriod: 'tarde', date: day }] },
  })
  ok(noBranch.status === 400 && /filial/i.test(noBranch.data?.message || ''), 'gerente multi-filial sem filial na vaga é recusado', noBranch.data?.message)
  await req('PUT', `/supermarket-members/${mkMember.data.id}`, { token: superT, body: { branchIds: [branchSul.id] } })

  section('Cargos configuráveis da equipe (tags)')
  const superRoles = (await req('GET', '/team-roles', { token: superT })).data
  ok(Array.isArray(superRoles) && superRoles.some((r) => r.name === 'Administrador') && superRoles.some((r) => r.name === 'RH'),
    'supermercado já nasce com a lista padrão de cargos', superRoles.map((r) => r.name))
  const ownerMember = (await req('GET', `/supermarkets/${supermarketId}/members`, { token: superT })).data.find((m) => m.isOwner)
  ok(ownerMember?.teamRole?.name === 'Administrador', 'o dono nasce com o cargo "Administrador" (no lugar do selo "dono")', ownerMember?.teamRole)

  const newRole = await req('POST', '/team-roles', { token: superT, body: { name: 'Supervisor de Loja' } })
  ok(newRole.status === 201 && newRole.data.name === 'Supervisor de Loja', 'dono cria um cargo novo')
  const dupRole = await req('POST', '/team-roles', { token: superT, body: { name: 'RH' } })
  ok(dupRole.status === 400, 'cargo duplicado é recusado')

  const roleMgrEmail = `gerente-cargo-${Date.now()}@email.com`
  const roleMgr = await req('POST', `/supermarkets/${supermarketId}/members`, {
    token: superT,
    body: { name: 'Gerente com Cargo', email: roleMgrEmail, password: '123456', teamRoleId: newRole.data.id },
  })
  ok(roleMgr.status === 201, 'gerente criado com cargo')
  const roleMgrListed = (await req('GET', `/supermarkets/${supermarketId}/members`, { token: superT })).data.find((m) => m.id === roleMgr.data.id)
  ok(roleMgrListed?.teamRole?.name === 'Supervisor de Loja', 'cargo do gerente aparece na listagem', roleMgrListed?.teamRole)

  const renamed = await req('PUT', `/team-roles/${newRole.data.id}`, { token: superT, body: { name: 'Supervisor' } })
  ok(renamed.status === 200 && renamed.data.name === 'Supervisor', 'cargo renomeado')
  const delRole = await req('DELETE', `/team-roles/${newRole.data.id}`, { token: superT })
  ok(delRole.status === 200, 'cargo removido')
  const afterDel = (await req('GET', `/supermarkets/${supermarketId}/members`, { token: superT })).data.find((m) => m.id === roleMgr.data.id)
  ok(afterDel && afterDel.teamRoleId == null, 'remover o cargo solta quem estava com ele (fica sem cargo)', afterDel?.teamRoleId)

  const agencyOwnRoles = (await req('GET', '/team-roles', { token: agencyT })).data
  ok(agencyOwnRoles.some((r) => r.name === 'Comercial'), 'agência tem a própria lista de cargos (líderes)', agencyOwnRoles.map((r) => r.name))
  const agencyViewClientRoles = (await req('GET', `/team-roles?supermarketId=${supermarketId}`, { token: agencyT })).data
  ok(agencyViewClientRoles.some((r) => r.name === 'Administrador') && !agencyViewClientRoles.some((r) => r.name === 'Comercial'),
    'agência lê a lista de cargos do supermercado-cliente via ?supermarketId', agencyViewClientRoles.map((r) => r.name))
  const leaderRoleBlocked = await req('POST', '/team-roles', { token: await login('leader@email.com'), body: { name: 'x' } })
  ok(leaderRoleBlocked.status === 403, 'líder de agência não gerencia cargos')
  const editable = caixaJobs[2]
  const edited = await req('PUT', `/jobs/${editable.id}`, { token: superT, body: { shiftPeriod: 'tarde', date: day } })
  ok(edited.status === 200 && edited.data.shiftPeriod === 'tarde', 'vaga pendente editada (turno)', edited.data?.shiftPeriod)
  const del = await req('DELETE', `/jobs/${caixaJobs[1].id}`, { token: superT })
  ok(del.status === 200, 'vaga pendente removida')

  section('Freelancer: disponíveis respeitam a tabela')
  // Remove o valor/hora do Padeiro agora que a vaga já existe — testa que ela para de
  // aparecer/ser aceitável, não que ela nunca pôde ser criada.
  await req('DELETE', `/supermarkets/${supermarketId}/rates/${ratePadeiro.id}`, { token: agencyT })
  const avail = (await req('GET', '/jobs/available', { token: freeT })).data
  ok(avail.some((j) => j.categoryId === catCaixa.id), 'Operador de Caixa aparece')
  ok(!avail.some((j) => j.categoryId === catPadeiro.id), 'Padeiro NÃO aparece (supermercado sem valor/hora)')
  const padeiroJob = order.orderJobs.find((j) => j.categoryId === catPadeiro.id)
  const accPad = await req('POST', `/jobs/${padeiroJob.id}/accept`, { token: freeT })
  ok(accPad.status === 400, 'aceitar vaga sem valor/hora do supermercado é bloqueado', accPad.data?.message)
  await req('POST', `/supermarkets/${supermarketId}/rates`, { token: agencyT, body: { categoryId: catPadeiro.id, hourlyRate: 33 } })

  section('Aceite + conflito de horário')
  const job = caixaJobs[0]
  const acc = await req('POST', `/jobs/${job.id}/accept`, { token: freeT })
  ok(acc.status === 200 && acc.data.status === 'accepted', 'vaga (manhã) aceita')
  // outra vaga de manhã no mesmo dia -> conflito
  const otherManha = avail.find((j) => j.categoryId === catCaixa.id && j.id !== job.id && j.shiftPeriod === 'manha')
  if (otherManha) {
    const clash = await req('POST', `/jobs/${otherManha.id}/accept`, { token: freeT })
    ok(clash.status === 400 && /já tem uma vaga/.test(clash.data?.message || ''), 'conflito de horário bloqueia o aceite', clash.data?.message)
  } else {
    ok(true, 'conflito de horário (sem 2ª vaga de manhã para testar — pulado)')
  }

  section('Check-in por turno + geolocalização (raio da agência)')
  const earlyCi = await req('POST', `/jobs/${job.id}/logs/checkin`, { token: freeT, body: { ...CENTRO, accuracy: 10 } })
  ok(earlyCi.status === 400 && /não é hora do check-in/i.test(earlyCi.data?.message || ''), 'check-in muito antes do turno recusado', earlyCi.data?.message)
  await startShiftNow(job.id)
  const noGeo = await req('POST', `/jobs/${job.id}/logs/checkin`, { token: freeT, body: {} })
  ok(noGeo.status === 400, 'check-in sem localização recusado')
  const farGeo = await req('POST', `/jobs/${job.id}/logs/checkin`, { token: freeT, body: FAR })
  ok(farGeo.status === 400 && /limite de/.test(farGeo.data?.message || ''), 'check-in fora do raio recusado', farGeo.data?.message)
  const ci = await req('POST', `/jobs/${job.id}/logs/checkin`, { token: freeT, body: { ...CENTRO, accuracy: 10 } })
  ok(ci.status === 201, 'check-in no local aceito', ci.data?.message)
  const jobCi = (await req('GET', `/jobs/${job.id}`, { token: freeT })).data
  ok(jobCi.status === 'in_progress' && jobCi.shifts[0].status === 'in_progress', 'vaga e turno em andamento')

  section('Agência: ao vivo')
  const live = (await req('GET', '/jobs/live', { token: agencyT })).data
  ok(Array.isArray(live) && live.some((j) => j.id === job.id), 'vaga aparece em /jobs/live')

  section('Check-out: exige foto (config da agência) e paga por horas')
  const coNoPhoto = await req('POST', `/jobs/${job.id}/logs/checkout`, { token: freeT, body: CENTRO })
  ok(coNoPhoto.status === 400, 'check-out sem foto recusado', coNoPhoto.data?.message)
  const fd = new FormData()
  fd.append('photo', new Blob(['x'], { type: 'image/jpeg' }), 'p.jpg')
  const up = await fetch(`${BASE}/jobs/${job.id}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${freeT}` }, body: fd })
  ok(up.status === 201, 'upload de foto 201', up.status)

  await db.query(`UPDATE job_shifts SET check_in_at = check_in_at - interval '6 hours' WHERE job_id=$1 AND status='in_progress'`, [job.id])
  await db.query(`UPDATE job_logs SET timestamp = timestamp - interval '6 hours' WHERE job_id=$1 AND event_type='check-in'`, [job.id])

  const freeBefore = Number((await req('GET', `/freelancers/${freelancerId}`, { token: freeT })).data.availableBalance)
  const agencyBefore = Number((await req('GET', `/agencies/${agencyId}`, { token: agencyT })).data.availableBalance)

  const co = await req('POST', `/jobs/${job.id}/logs/checkout`, { token: freeT, body: CENTRO })
  ok(co.status === 201 && co.data.jobCompleted === true, 'check-out conclui a vaga (turno único)')
  ok(co.data.settlementHeld === false, 'dentro da tolerância -> pagamento liberado na hora')
  const done = (await req('GET', `/jobs/${job.id}`, { token: freeT })).data
  // supermercado paga 32/h x 6h = 192 ; colaborador recebe 20/h x 6h = 120 ; agência 72
  ok(Math.abs(Number(done.grossAmount) - 192) < 1, 'valor pago pelo mercado ~ R$ 192 (32/h x 6h)', done.grossAmount)

  const freeAfter = Number((await req('GET', `/freelancers/${freelancerId}`, { token: freeT })).data.availableBalance)
  const agencyAfter = Number((await req('GET', `/agencies/${agencyId}`, { token: agencyT })).data.availableBalance)
  ok(Math.abs((freeAfter - freeBefore) - 120) < 1, 'carteira do freelancer +120,00 (20/h x 6h)', freeAfter - freeBefore)
  ok(Math.abs((agencyAfter - agencyBefore) - 72) < 1, 'carteira da agência +72,00 (192 - 120)', agencyAfter - agencyBefore)

  section('Hora extra acima da tolerância -> pagamento retido até a agência liberar')
  const extraJob = caixaJobs[2] // editada para o turno da tarde (12–18, 360 min contratados)
  await req('POST', `/jobs/${extraJob.id}/accept`, { token: freeT })
  await startShiftNow(extraJob.id)
  await req('POST', `/jobs/${extraJob.id}/logs/checkin`, { token: freeT, body: { ...CENTRO, accuracy: 10 } })
  const fd2 = new FormData()
  fd2.append('photo', new Blob(['x'], { type: 'image/jpeg' }), 'p.jpg')
  await fetch(`${BASE}/jobs/${extraJob.id}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${freeT}` }, body: fd2 })
  // trabalhou ~7h contra 6h contratadas -> 60 min acima da tolerância de 15
  await db.query(`UPDATE job_shifts SET check_in_at = NOW() - interval '7 hours' WHERE job_id=$1 AND status='in_progress'`, [extraJob.id])
  const coExtra = await req('POST', `/jobs/${extraJob.id}/logs/checkout`, { token: freeT, body: CENTRO })
  ok(coExtra.status === 201 && coExtra.data.jobCompleted === true && coExtra.data.settlementHeld === true, 'check-out com hora extra conclui a vaga mas retém o pagamento')
  const heldJob = (await req('GET', `/jobs/${extraJob.id}`, { token: freeT })).data
  ok(heldJob.settlementHold === true && heldJob.grossAmount == null, 'vaga concluída sem valor liquidado (retida)')
  const pend = (await req('GET', '/agency/pending-settlement', { token: agencyT })).data
  ok(Array.isArray(pend) && pend.some((j) => j.id === extraJob.id), 'vaga retida aparece em /agency/pending-settlement')
  const freeMid = Number((await req('GET', `/freelancers/${freelancerId}`, { token: freeT })).data.availableBalance)
  ok(Math.abs(freeMid - freeAfter) < 0.01, 'carteira do freelancer NÃO mexe enquanto o pagamento está retido', freeMid - freeAfter)
  const rlz = await req('POST', `/jobs/${extraJob.id}/release-payment`, { token: agencyT })
  ok(rlz.status === 200 && rlz.data.settlementHold === false, 'agência libera o pagamento da vaga retida')
  const releasedJob = (await req('GET', `/jobs/${extraJob.id}`, { token: freeT })).data
  ok(Number(releasedJob.grossAmount) > 192, 'valor liberado considera as horas reais (> 6h)', releasedJob.grossAmount)
  const freeReleased = Number((await req('GET', `/freelancers/${freelancerId}`, { token: freeT })).data.availableBalance)
  ok(freeReleased > freeMid, 'carteira do freelancer credita após a liberação', freeReleased - freeMid)

  section('Freelancer desiste da vaga (dentro / fora do prazo)')
  const repToWithdraw = order.orderJobs.find((j) => j.categoryId === catRepositor.id)
  await req('POST', `/jobs/${repToWithdraw.id}/accept`, { token: freeT })
  const wOk = await req('POST', `/jobs/${repToWithdraw.id}/withdraw`, { token: freeT })
  ok(wOk.status === 200 && wOk.data.status === 'pending' && !wOk.data.freelancerId, 'desistência dentro do prazo -> volta a pending')
  ok((wOk.data.jobLogs ?? []).some((l) => l.eventType === 'withdrawn'), 'registra log de desistência')

  await req('POST', `/jobs/${repToWithdraw.id}/accept`, { token: freeT })
  await db.query(`UPDATE jobs SET start_time = NOW() + interval '10 minutes' WHERE id=$1`, [repToWithdraw.id])
  const wLate = await req('POST', `/jobs/${repToWithdraw.id}/withdraw`, { token: freeT })
  ok(wLate.status === 400 && /prazo de cancelamento/.test(wLate.data?.message || ''), 'fora do prazo -> bloqueado', wLate.data?.message)

  section('Agência libera a vaga do freelancer')
  const rel = await req('POST', `/jobs/${repToWithdraw.id}/release`, { token: agencyT })
  ok(rel.status === 200 && rel.data.status === 'pending', 'agência libera -> volta a pending')

  section('Agência fecha vagas vencidas não preenchidas')
  const expOrder = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 2, date: day, shifts: [{ startTime: '09:00', endTime: '12:00' }] }] },
  })
  const expJobs = expOrder.data.orderJobs
  await db.query(`UPDATE jobs SET start_time = NOW() - interval '2 days', end_time = NOW() - interval '2 days' + interval '3 hours' WHERE order_id = $1`, [expJobs[0].orderId])
  const futureOrder = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day, shifts: [{ startTime: '09:00', endTime: '12:00' }] }] },
  })
  const closeOne = await req('POST', `/agency/jobs/${expJobs[0].id}/close-unfilled`, { token: agencyT })
  ok(closeOne.status === 200 && closeOne.data.status === 'canceled', 'agência fecha uma vaga vencida sem colaborador', closeOne.data?.status)
  const closeFuture = await req('POST', `/agency/jobs/${futureOrder.data.orderJobs[0].id}/close-unfilled`, { token: agencyT })
  ok(closeFuture.status !== 200, 'vaga futura não pode ser fechada como vencida', closeFuture.status)
  const closeBulk = await req('POST', '/agency/jobs/close-expired-unfilled', { token: agencyT })
  ok(closeBulk.status === 200 && closeBulk.data.closed >= 1, 'ação em massa fecha as vagas vencidas restantes', closeBulk.data)
  const stillFuture = (await req('GET', `/jobs/${futureOrder.data.orderJobs[0].id}`, { token: agencyT })).data
  ok(stillFuture.status === 'pending', 'a vaga futura segue disponível após a ação em massa', stillFuture.status)

  section('Ações da agência sobre a vaga (força checkout / trocar colaborador)')
  const free2T = await login('free2@email.com')
  const free2Id = (await req('GET', '/auth/me', { token: free2T })).data.profile.id

  // Nota: o seed já deixa Joana com uma vaga "noite" (18–24) aceita — por isso as vagas de
  // teste aqui usam tarde/madrugada/manhã, que ficam livres pra ela nesse ponto do fluxo.
  const actOrder = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [
        { categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, shiftPeriod: 'tarde', date: day }, // A: reassign sem trabalho
        { categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, shiftPeriod: 'tarde', date: day }, // D: pra testar conflito de horário
        { categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, shiftPeriod: 'madrugada', date: day }, // B: força checkout
        {
          categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day, // C: reassign com trabalho parcial
          shifts: [
            { shiftPeriod: 'madrugada', startTime: '01:00', endTime: '02:00' },
            { shiftPeriod: 'manha', startTime: '09:00', endTime: '10:00' },
          ],
        },
      ],
    },
  })
  ok(actOrder.status === 201, 'vagas de teste criadas', actOrder.status === 201 ? undefined : actOrder.data)
  const tardeJobs = actOrder.data.orderJobs.filter((j) => j.shiftPeriod === 'tarde')
  const jobA = tardeJobs[0]
  const jobD = tardeJobs[1]
  const madrugadaJobs = actOrder.data.orderJobs.filter((j) => j.shiftPeriod === 'madrugada')
  const jobB = madrugadaJobs.find((j) => (j.shifts?.length ?? 1) === 1)
  const jobC = madrugadaJobs.find((j) => (j.shifts?.length ?? 1) === 2)

  // --- Trocar colaborador (sem trabalho ainda) ---
  const acceptA = await req('POST', `/jobs/${jobA.id}/accept`, { token: freeT })
  ok(acceptA.status === 200, 'vaga A aceita antes do reassign', acceptA.data)
  const reassignA = await req('POST', `/jobs/${jobA.id}/reassign`, { token: agencyT, body: { freelancerId: free2Id, reason: 'teste' } })
  ok(
    reassignA.status === 200 && reassignA.data.freelancerId === free2Id && reassignA.data.status === 'accepted',
    'reassign sem trabalho: troca direta pro novo colaborador',
    reassignA.data
  )
  const jobAForOldFreelancer = await req('GET', `/jobs/${jobA.id}`, { token: freeT })
  ok(jobAForOldFreelancer.status === 404, 'freelancer antigo perde acesso à vaga depois da troca')

  // --- Reassign respeita conflito de horário do novo colaborador ---
  await req('POST', `/jobs/${jobD.id}/accept`, { token: freeT })
  const reassignClash = await req('POST', `/jobs/${jobD.id}/reassign`, { token: agencyT, body: { freelancerId: free2Id } })
  ok(
    reassignClash.status === 400 && /já tem uma vaga/.test(reassignClash.data?.message || ''),
    'reassign bloqueado se o novo colaborador já tem vaga aceita no mesmo horário',
    reassignClash.data?.message
  )

  // --- Reassign exige valor/hora do novo colaborador na função da vaga ---
  const repOrder = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catRepositor.id, branchId: branchCentro.id, quantity: 1, shiftPeriod: 'madrugada', date: day }] },
  })
  const repReassignJob = repOrder.data.orderJobs[0]
  await req('POST', `/jobs/${repReassignJob.id}/accept`, { token: freeT }) // Joana tem Repositor
  const reassignNoRate = await req('POST', `/jobs/${repReassignJob.id}/reassign`, { token: agencyT, body: { freelancerId: free2Id } })
  ok(
    reassignNoRate.status === 400 && /valor\/hora/.test(reassignNoRate.data?.message || ''),
    'reassign bloqueado se o novo colaborador não tem valor/hora na função da vaga (Pedro não faz Repositor)',
    reassignNoRate.data?.message
  )
  await req('POST', `/jobs/${repReassignJob.id}/withdraw`, { token: freeT }) // libera a agenda da Joana pros testes seguintes

  // --- Checkout forçado pela agência ---
  await req('POST', `/jobs/${jobB.id}/accept`, { token: freeT })
  const forceNoReason = await req('POST', `/jobs/${jobB.id}/force-checkout`, { token: agencyT, body: {} })
  ok(forceNoReason.status === 400, 'checkout forçado exige motivo')
  const forceBeforeCheckin = await req('POST', `/jobs/${jobB.id}/force-checkout`, { token: agencyT, body: { reason: 'teste' } })
  ok(forceBeforeCheckin.status === 400, 'checkout forçado só em vaga em andamento (ainda não fez check-in)', forceBeforeCheckin.data?.message)
  await startShiftNow(jobB.id)
  await req('POST', `/jobs/${jobB.id}/logs/checkin`, { token: freeT, body: { ...CENTRO, accuracy: 10 } })
  const forced = await req('POST', `/jobs/${jobB.id}/force-checkout`, { token: agencyT, body: { reason: 'app do colaborador travou' } })
  ok(
    forced.status === 200 && forced.data.status === 'completed',
    'checkout forçado conclui a vaga sem exigir foto/geofence do colaborador',
    forced.data
  )
  ok((forced.data.jobLogs ?? []).some((l) => l.eventType === 'forced-checkout'), 'log registra o evento forced-checkout')

  // --- Trocar colaborador com trabalho parcial já feito (2 turnos, 1º concluído) ---
  await req('POST', `/jobs/${jobC.id}/accept`, { token: freeT })
  await startShiftNow(jobC.id)
  await req('POST', `/jobs/${jobC.id}/logs/checkin`, { token: freeT, body: { ...CENTRO, accuracy: 10 } })
  await db.query(`UPDATE job_shifts SET check_in_at = check_in_at - interval '1 hour' WHERE job_id=$1 AND status='in_progress'`, [jobC.id])
  const fdC = new FormData()
  fdC.append('photo', new Blob(['x'], { type: 'image/jpeg' }), 'p.jpg')
  await fetch(`${BASE}/jobs/${jobC.id}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${freeT}` }, body: fdC })
  const coC = await req('POST', `/jobs/${jobC.id}/logs/checkout`, { token: freeT, body: CENTRO })
  ok(coC.status === 201 && coC.data.jobCompleted === false, '1º turno da vaga C encerrado, vaga segue em andamento (2º turno pendente)', coC.data)

  const reassignC = await req('POST', `/jobs/${jobC.id}/reassign`, { token: agencyT, body: { freelancerId: free2Id, reason: '2º turno com outro colaborador' } })
  ok(
    reassignC.status === 200 && reassignC.data.freelancerId === free2Id && reassignC.data.status === 'accepted',
    'reassign com trabalho parcial: vaga nova (restante) já sai atribuída ao novo colaborador',
    reassignC.data
  )
  ok(reassignC.data.id !== jobC.id, 'reassign com trabalho parcial cria uma vaga nova pro restante (não reaproveita a original)')
  const originalC = (await req('GET', `/jobs/${jobC.id}`, { token: agencyT })).data
  ok(
    originalC.status === 'canceled' && Number(originalC.workedMinutes) > 0,
    'vaga original fecha como canceled com as horas do 1º turno liquidadas pro freelancer antigo',
    originalC
  )

  section('Turnos personalizáveis (janela livre, cruza meia-noite, múltiplos turnos)')
  // Turno contínuo 22:00 -> 06:00 (atravessa a meia-noite): 8h contratadas, fim no dia seguinte.
  const nightOrder = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day,
        shifts: [{ startTime: '22:00', endTime: '06:00', nominalPeriod: 'noite' }],
      }],
    },
  })
  ok(nightOrder.status === 201, 'pedido com turno que cruza a meia-noite aceito', nightOrder.data?.message)
  const nightJob = nightOrder.data.orderJobs[0]
  ok(Number(nightJob.contractedMinutes) === 480, 'turno 22:00–06:00 = 480 min contratados', nightJob.contractedMinutes)
  ok(
    new Date(nightJob.endTime).getTime() - new Date(nightJob.startTime).getTime() === 8 * 3600 * 1000,
    'fim da vaga cai no dia seguinte (janela de 8h)',
  )

  const overlap = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day,
        shifts: [
          { startTime: '10:00', endTime: '14:00' },
          { startTime: '13:00', endTime: '16:00' },
        ],
      }],
    },
  })
  ok(overlap.status === 400 && /sobrepor/.test(overlap.data?.message || ''), 'turnos que se sobrepõem são recusados', overlap.data?.message)

  const gapOrder = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day,
        shifts: [
          { startTime: '10:00', endTime: '12:00' },
          { startTime: '15:00', endTime: '18:00' },
        ],
      }],
    },
  })
  ok(gapOrder.status === 201, 'pedido com 2 turnos e intervalo entre eles aceito')
  const gapJob = gapOrder.data.orderJobs[0]
  ok((gapJob.shifts?.length ?? 0) === 2 && Number(gapJob.contractedMinutes) === 300, '2 turnos, 5h contratadas (intervalo não conta)', gapJob.contractedMinutes)

  // --- Intervalo do turno descontado das horas contratadas + teto legal de jornada ---
  const brkOrder = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day,
        shifts: [{ startTime: '08:00', endTime: '15:00', breakMinutes: 60 }],
      }],
    },
  })
  ok(brkOrder.status === 201, 'turno de 7h com intervalo de 60 min aceito')
  ok(Number(brkOrder.data.orderJobs[0].contractedMinutes) === 360,
    'contabilizador desconta o intervalo: 7h − 60min = 6h contratadas', brkOrder.data.orderJobs[0].contractedMinutes)

  await req('PUT', '/agency/settings', { token: agencyT, body: { defaultBreakMinutes: 45 } })
  const defBrkOrder = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day,
        shifts: [{ startTime: '08:00', endTime: '14:00', useDefaultBreak: true }],
      }],
    },
  })
  ok(defBrkOrder.status === 201 && Number(defBrkOrder.data.orderJobs[0].contractedMinutes) === 315,
    'usar intervalo padrão da agência (45min): turno de 6h fica 5h15 contratadas', defBrkOrder.data?.orderJobs?.[0]?.contractedMinutes)
  await req('PUT', '/agency/settings', { token: agencyT, body: { defaultBreakMinutes: 0 } })

  const overJob = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day,
        shifts: [{ startTime: '06:00', endTime: '18:00' }],
      }],
    },
  })
  ok(overJob.status === 400 && /limite/i.test(overJob.data?.message || ''),
    'vaga com soma de turnos acima do teto (10h) é recusada', overJob.data?.message)

  await req('PUT', '/agency/settings', { token: agencyT, body: { maxShiftHours: 6 } })
  const overShift = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day,
        shifts: [{ startTime: '08:00', endTime: '15:00' }],
      }],
    },
  })
  ok(overShift.status === 400 && /turno/i.test(overShift.data?.message || ''),
    'turno acima do teto por turno (6h) é recusado', overShift.data?.message)
  await req('PUT', '/agency/settings', { token: agencyT, body: { maxShiftHours: 10 } })

  const badMaxJob = await req('PUT', '/agency/settings', { token: agencyT, body: { maxJobHours: 40 } })
  ok(badMaxJob.status === 400, 'máximo de horas por vaga fora da faixa é recusado', badMaxJob.data?.message)

  // Turnos com nome personalizado: o supermercado escreve o rótulo que quiser; sem nome, cai em "Turno N".
  const namedOrder = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day,
        shifts: [
          { startTime: '08:00', endTime: '13:00', nominalPeriod: 'manha', custom: true, label: 'Abertura da loja' },
          { startTime: '14:00', endTime: '19:00', nominalPeriod: 'tarde', custom: true, label: '' },
        ],
      }],
    },
  })
  ok(namedOrder.status === 201, 'pedido com turnos de nome personalizado aceito', namedOrder.data?.message)
  const namedShifts = [...(namedOrder.data.orderJobs[0].shifts ?? [])].sort((a, b) => a.position - b.position)
  ok(namedShifts[0]?.label === 'Abertura da loja', '1º turno guarda o nome personalizado', namedShifts[0]?.label)
  ok(namedShifts[1]?.label === 'Turno 2', '2º turno sem nome cai no padrão "Turno N"', namedShifts[1]?.label)

  // A antecedência do check-in vale para todos os turnos: o 2º turno não abre longe do horário dele.
  const seqOrder = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day,
        shifts: [
          { startTime: '08:00', endTime: '10:00', nominalPeriod: 'manha' },
          { startTime: '16:00', endTime: '18:00', nominalPeriod: 'tarde' },
        ],
      }],
    },
  })
  const seqJob = seqOrder.data.orderJobs[0]
  // Libera vagas do Pedro pra evitar conflito de agenda no aceite.
  for (const j of (await req('GET', '/jobs', { token: agencyT })).data
    .filter((j) => j.freelancerId === free2Id && ['accepted', 'in_progress'].includes(j.status))) {
    await req('POST', `/jobs/${j.id}/release`, { token: agencyT })
  }
  const seqAcc = await req('POST', `/jobs/${seqJob.id}/accept`, { token: free2T })
  ok(seqAcc.status === 200, 'vaga de 2 turnos aceita pelo colaborador', seqAcc.data?.message)
  // Só o 1º turno vira "agora"; o 2º segue no horário original (daqui a horas).
  await db.query(
    `UPDATE job_shifts SET start_time = NOW() - interval '5 minutes', end_time = NOW() + interval '30 minutes'
     WHERE job_id = $1 AND position = 0`,
    [seqJob.id]
  )
  await req('POST', `/jobs/${seqJob.id}/logs/checkin`, { token: free2T, body: { ...CENTRO, accuracy: 10 } })
  await db.query(`UPDATE job_shifts SET check_in_at = NOW() - interval '90 minutes' WHERE job_id=$1 AND position=0`, [seqJob.id])
  const fdSeq = new FormData()
  fdSeq.append('photo', new Blob(['x'], { type: 'image/jpeg' }), 'p.jpg')
  await fetch(`${BASE}/jobs/${seqJob.id}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${free2T}` }, body: fdSeq })
  await req('POST', `/jobs/${seqJob.id}/logs/checkout`, { token: free2T, body: CENTRO })
  const earlyNext = await req('POST', `/jobs/${seqJob.id}/logs/checkin`, { token: free2T, body: { ...CENTRO, accuracy: 10 } })
  ok(
    earlyNext.status === 400 && /Ainda não é hora do check-in/.test(earlyNext.data?.message || ''),
    'check-in do 2º turno é recusado longe do horário dele (mesmo com o 1º turno já encerrado)',
    earlyNext.data?.message
  )
  await req('POST', `/jobs/${seqJob.id}/release`, { token: agencyT })

  section('Pausar / retomar o ponto (intervalo escolhido pelo colaborador)')
  // Libera todas as vagas aceitas/em andamento do Pedro pra ele ficar livre nos testes a seguir.
  for (const j of (await req('GET', '/jobs', { token: agencyT })).data
    .filter((j) => j.freelancerId === free2Id && ['accepted', 'in_progress'].includes(j.status))) {
    await req('POST', `/jobs/${j.id}/release`, { token: agencyT })
  }

  // Vaga com pausa habilitada por override no item do pedido.
  const breakOrder = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day, breaksEnabled: true,
        shifts: [{ startTime: '13:00', endTime: '19:00', nominalPeriod: 'tarde' }],
      }],
    },
  })
  const breakJob = breakOrder.data.orderJobs[0]
  await req('POST', `/jobs/${breakJob.id}/accept`, { token: free2T })
  await startShiftNow(breakJob.id)
  await req('POST', `/jobs/${breakJob.id}/logs/checkin`, { token: free2T, body: { ...CENTRO, accuracy: 10 } })
  await db.query(`UPDATE job_shifts SET check_in_at = NOW() - interval '4 hours' WHERE job_id=$1 AND status='in_progress'`, [breakJob.id])

  const brkStart = await req('POST', `/jobs/${breakJob.id}/logs/break-start`, { token: free2T, body: CENTRO })
  ok(brkStart.status === 201, 'colaborador pausa o ponto', brkStart.data?.message)
  const coDuringBreak = await req('POST', `/jobs/${breakJob.id}/logs/checkout`, { token: free2T, body: CENTRO })
  ok(coDuringBreak.status === 400 && /pausa/.test(coDuringBreak.data?.message || ''), 'check-out recusado com pausa aberta', coDuringBreak.data?.message)
  await db.query(`UPDATE job_shift_breaks SET start_at = NOW() - interval '30 minutes' WHERE job_id=$1 AND end_at IS NULL`, [breakJob.id])
  const brkEnd = await req('POST', `/jobs/${breakJob.id}/logs/break-end`, { token: free2T, body: CENTRO })
  ok(brkEnd.status === 201, 'colaborador retoma o ponto')

  const fdBrk = new FormData()
  fdBrk.append('photo', new Blob(['x'], { type: 'image/jpeg' }), 'p.jpg')
  await fetch(`${BASE}/jobs/${breakJob.id}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${free2T}` }, body: fdBrk })
  const coBrk = await req('POST', `/jobs/${breakJob.id}/logs/checkout`, { token: free2T, body: CENTRO })
  ok(coBrk.status === 201, 'check-out depois de retomar', coBrk.data?.message)
  const brkDone = (await req('GET', `/jobs/${breakJob.id}`, { token: free2T })).data
  // ~4h de turno − 30 min de pausa ≈ 210 min
  ok(Math.abs(Number(brkDone.workedMinutes) - 210) <= 3, 'minutos trabalhados descontam a pausa (~210)', brkDone.workedMinutes)

  // Pausa desabilitada: recusada.
  const noBreakOrder = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day, shifts: [{ startTime: '08:00', endTime: '12:00' }] }] },
  })
  const noBreakJob = noBreakOrder.data.orderJobs[0]
  await req('POST', `/jobs/${noBreakJob.id}/accept`, { token: free2T })
  await startShiftNow(noBreakJob.id)
  await req('POST', `/jobs/${noBreakJob.id}/logs/checkin`, { token: free2T, body: { ...CENTRO, accuracy: 10 } })
  const brkDisabled = await req('POST', `/jobs/${noBreakJob.id}/logs/break-start`, { token: free2T, body: CENTRO })
  ok(brkDisabled.status === 400 && /não está habilitada/.test(brkDisabled.data?.message || ''), 'pausa recusada quando não habilitada na vaga', brkDisabled.data?.message)
  await req('POST', `/jobs/${noBreakJob.id}/force-checkout`, { token: agencyT, body: { reason: 'fim do teste' } })

  section('Limite de minutos de pausa por turno (item 9)')
  const badLimit = await req('PUT', '/agency/settings', { token: agencyT, body: { breakLimitMinutes: 999 } })
  ok(badLimit.status === 400, 'limite de pausa fora da faixa (1–480) é recusado', badLimit.data?.message)
  await req('PUT', '/agency/settings', { token: agencyT, body: { breakLimitMinutes: 20 } })
  const limitOrder = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day, breaksEnabled: true, shifts: [{ startTime: '08:00', endTime: '16:00' }] }] },
  })
  const limitJob = limitOrder.data.orderJobs[0]
  await req('POST', `/jobs/${limitJob.id}/accept`, { token: free2T })
  await startShiftNow(limitJob.id)
  await req('POST', `/jobs/${limitJob.id}/logs/checkin`, { token: free2T, body: { ...CENTRO, accuracy: 10 } })
  const bl1 = await req('POST', `/jobs/${limitJob.id}/logs/break-start`, { token: free2T, body: CENTRO })
  ok(bl1.status === 201, 'primeira pausa dentro do limite é permitida', bl1.data?.message)
  await db.query(`UPDATE job_shift_breaks SET start_at = NOW() - interval '30 minutes' WHERE job_id=$1 AND end_at IS NULL`, [limitJob.id])
  const bl1e = await req('POST', `/jobs/${limitJob.id}/logs/break-end`, { token: free2T, body: CENTRO })
  ok(bl1e.status === 201, 'retomar o ponto fecha a pausa (~30 min, acima do limite de 20)')
  const bl2 = await req('POST', `/jobs/${limitJob.id}/logs/break-start`, { token: free2T, body: CENTRO })
  ok(bl2.status === 400 && /limite/i.test(bl2.data?.message || ''), 'nova pausa recusada depois de atingido o limite do turno', bl2.data?.message)
  await req('PUT', `/agency/jobs/${limitJob.id}`, { token: agencyT, body: { breakLimitMinutes: 120 } })
  const bl3 = await req('POST', `/jobs/${limitJob.id}/logs/break-start`, { token: free2T, body: CENTRO })
  ok(bl3.status === 201, 'override de limite por vaga (120 min) libera nova pausa', bl3.data?.message)
  await req('POST', `/jobs/${limitJob.id}/logs/break-end`, { token: free2T, body: CENTRO })
  await req('POST', `/jobs/${limitJob.id}/force-checkout`, { token: agencyT, body: { reason: 'fim do teste' } })
  await req('PUT', '/agency/settings', { token: agencyT, body: { breakLimitMinutes: null } })
  const settingsNoLimit = (await req('GET', '/agency/settings', { token: agencyT })).data
  ok(settingsNoLimit.breakLimitMinutes === null, 'limite de pausa volta a "sem limite"', settingsNoLimit.breakLimitMinutes)

  section('Colaborador desiste da vaga em andamento (item 7)')
  const quitOrder = await req('POST', '/orders', {
    token: superT,
    body: {
      items: [{
        categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day,
        shifts: [
          { startTime: '08:00', endTime: '12:00' },
          { startTime: '14:00', endTime: '18:00' },
        ],
      }],
    },
  })
  const quitJob = quitOrder.data.orderJobs[0]
  await req('POST', `/jobs/${quitJob.id}/accept`, { token: free2T })
  await startShiftNow(quitJob.id)
  await req('POST', `/jobs/${quitJob.id}/logs/checkin`, { token: free2T, body: { ...CENTRO, accuracy: 10 } })
  await db.query(`UPDATE job_shifts SET check_in_at = NOW() - interval '2 hours' WHERE job_id=$1 AND status='in_progress'`, [quitJob.id])
  const quitBefore = Number((await req('GET', `/freelancers/${free2Id}`, { token: free2T })).data.availableBalance)
  const quit = await req('POST', `/jobs/${quitJob.id}/withdraw`, { token: free2T, body: { reason: 'emergência' } })
  ok(quit.status === 200 && quit.data.status === 'canceled' && Math.abs(Number(quit.data.workedMinutes) - 120) <= 3, 'desistência em andamento fecha a vaga com as horas já feitas', quit.data?.workedMinutes)
  const quitAfter = Number((await req('GET', `/freelancers/${free2Id}`, { token: free2T })).data.availableBalance)
  ok(Math.abs((quitAfter - quitBefore) - 40) <= 1, 'colaborador que saiu recebe as ~2h trabalhadas (20/h -> +40)', quitAfter - quitBefore)
  const restante = (await req('GET', '/jobs', { token: agencyT })).data
    .find((j) => j.orderId === quitJob.orderId && j.status === 'pending' && /restante/i.test(j.title || ''))
  ok(!!restante && (restante.shifts?.length ?? 0) >= 2, 'restante da vaga volta pro pool como vaga pendente', restante && { title: restante.title, shifts: restante.shifts?.length })
  await req('POST', `/jobs/${restante.id}/accept`, { token: free2T })
  ok(true, 'outro colaborador consegue aceitar o restante')
  await req('POST', `/jobs/${restante.id}/release`, { token: agencyT }) // cleanup

  section('Agência corrige horário e ponto da vaga')
  // Remarca um turno ainda pendente de uma vaga aceita.
  const schedOrder = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: day, shifts: [{ startTime: '14:00', endTime: '18:00' }] }] },
  })
  const schedJob = schedOrder.data.orderJobs[0]
  await req('POST', `/jobs/${schedJob.id}/accept`, { token: free2T })
  const schedShiftId = (await req('GET', `/jobs/${schedJob.id}`, { token: agencyT })).data.shifts[0].id
  const newStart = new Date(`${day}T15:00:00-03:00`).toISOString()
  const newEnd = new Date(`${day}T20:00:00-03:00`).toISOString()
  const resched = await req('PUT', `/agency/jobs/${schedJob.id}/timesheet`, {
    token: agencyT,
    body: { reason: 'erro de lançamento', shifts: [{ shiftId: schedShiftId, startTime: newStart, endTime: newEnd }] },
  })
  ok(resched.status === 200 && Number(resched.data.contractedMinutes) === 300, 'agência remarca turno pendente (4h -> 5h)', resched.data?.contractedMinutes)
  await req('POST', `/jobs/${schedJob.id}/release`, { token: agencyT }) // cleanup

  // Corrige o ponto de uma vaga JÁ LIQUIDADA -> reajusta pagamento + carteiras.
  const settledJob = brkDone // a vaga do teste de pausa, já concluída e liquidada
  const payBefore = Number((await req('GET', `/freelancers/${free2Id}`, { token: free2T })).data.availableBalance)
  const settledShift = (await req('GET', `/jobs/${settledJob.id}`, { token: agencyT })).data.shifts[0]
  const laterCheckout = new Date(new Date(settledShift.checkOutAt).getTime() + 60 * 60 * 1000).toISOString()
  const fix = await req('PUT', `/agency/jobs/${settledJob.id}/timesheet`, {
    token: agencyT,
    body: { reason: 'colaborador saiu 1h depois', shifts: [{ shiftId: settledShift.id, checkOutAt: laterCheckout }] },
  })
  ok(fix.status === 200 && Number(fix.data.workedMinutes) > Number(settledJob.workedMinutes), 'correção de ponto aumenta os minutos trabalhados', { was: settledJob.workedMinutes, now: fix.data?.workedMinutes })
  const payAfter = Number((await req('GET', `/freelancers/${free2Id}`, { token: free2T })).data.availableBalance)
  ok(payAfter > payBefore, 'carteira do colaborador é reajustada após a correção da vaga já paga', payAfter - payBefore)

  section('Fechamento mensal: por matriz e prévia por loja')
  const ref = yyyymm()
  await db.query(`UPDATE jobs SET completed_at = NOW() WHERE status='completed' AND supermarket_id=$1 AND monthly_invoice_id IS NULL`, [supermarketId])
  const prevMatriz = (await req('GET', `/closings/preview?supermarketId=${supermarketId}&referenceMonth=${ref}`, { token: agencyT })).data
  ok(prevMatriz.totals.totalJobs >= 1, 'prévia (matriz) lista vagas', prevMatriz.totals?.totalJobs)
  const prevLojaSul = (await req('GET', `/closings/preview?supermarketId=${supermarketId}&referenceMonth=${ref}&branchId=${branchSul.id}`, { token: agencyT })).data
  ok(prevLojaSul.totals.totalJobs === 0, 'prévia por loja (Zona Sul) vazia — vagas foram na Centro', prevLojaSul.totals?.totalJobs)

  // Item 3: nome com acentos + caractere exótico não pode quebrar o PDF do fechamento.
  await db.query(`UPDATE freelancers SET name = $1 WHERE id = $2`, ['João Conceição — Açaí 😀', free2Id])

  const close = await req('POST', '/closings', { token: agencyT, body: { supermarketId, referenceMonth: ref } })
  ok(close.status === 201 && close.data.type === 'monthly' && close.data.branchId == null, 'fechamento da matriz criado')
  ok(Number(close.data.totalAmount) > 0, 'fatura mensal com valor', close.data?.totalAmount)

  const pdfRes = await fetch(`${BASE}/closings/${close.data.id}/pdf`, { headers: { Authorization: `Bearer ${agencyT}` } })
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer())
  ok(
    pdfRes.ok && /pdf/i.test(pdfRes.headers.get('content-type') || '') && pdfBuf.length > 800 && pdfBuf.slice(0, 5).toString() === '%PDF-',
    'PDF do fechamento gera mesmo com nome acentuado + emoji (pendência 3)',
    { status: pdfRes.status, type: pdfRes.headers.get('content-type'), bytes: pdfBuf.length }
  )
  await db.query(`UPDATE freelancers SET name = 'Pedro Freelancer' WHERE id = $1`, [free2Id])

  section('Faturamento do supermercado (dados + filtros)')
  const billing = (await req('GET', '/billing/summary', { token: superT })).data
  ok(Array.isArray(billing.jobs) && Array.isArray(billing.branches) && Array.isArray(billing.invoices), 'summary tem jobs/branches/invoices')
  ok(billing.jobs.some((j) => j.categoryName === 'Operador de Caixa' && j.branchName === 'Filial Centro'), 'linha com função + loja')
  ok(billing.invoices.some((i) => i.id === close.data.id && i.branchName == null), 'fatura mensal (matriz) no faturamento')
  ok(billing.totals.workedHours > 0, 'totais com horas trabalhadas', billing.totals?.workedHours)

  section('Permissão do gerente: ver x pagar a fatura (canViewInvoices / canPayInvoices)')
  const invForPerm = close.data.id
  const mgrBillingBlocked = await req('GET', '/billing/summary', { token: mgrT })
  ok(mgrBillingBlocked.status === 403, 'gerente sem permissão não vê o faturamento', mgrBillingBlocked.status)
  const mgrInvoicesBlocked = await req('GET', '/invoices/mine', { token: mgrT })
  ok(mgrInvoicesBlocked.status === 403, 'gerente sem permissão não lista as faturas', mgrInvoicesBlocked.status)

  // A agência libera só o "ver".
  const grantView = await req('PUT', `/supermarket-members/${mkMember.data.id}`, { token: agencyT, body: { canViewInvoices: true } })
  ok(grantView.status === 200 && grantView.data.canViewInvoices === true && grantView.data.canPayInvoices === false, 'agência libera só a visualização das faturas')
  const mgrBillingOk = await req('GET', '/billing/summary', { token: mgrT })
  ok(mgrBillingOk.status === 200 && Array.isArray(mgrBillingOk.data.jobs), 'gerente com "ver" enxerga o faturamento')
  const mgrPayBlocked = await req('POST', `/invoices/${invForPerm}/pay`, { token: mgrT })
  ok(mgrPayBlocked.status === 403, 'quem só vê não paga a fatura', mgrPayBlocked.status)
  const mgrAdjBlocked = await req('POST', `/invoices/${invForPerm}/adjustments`, { token: mgrT, body: { description: 'x', amount: 1 } })
  ok(mgrAdjBlocked.status === 403, 'quem só vê não lança contestação', mgrAdjBlocked.status)

  // O dono adiciona o "pagar" (que implica "ver").
  const grantPay = await req('PUT', `/supermarket-members/${mkMember.data.id}`, { token: superT, body: { canPayInvoices: true } })
  ok(grantPay.status === 200 && grantPay.data.canPayInvoices === true, 'dono libera o gerente para pagar/contestar')
  const mgrAdjOk = await req('POST', `/invoices/${invForPerm}/adjustments`, { token: mgrT, body: { description: 'teste permissão', amount: 1 } })
  ok(mgrAdjOk.status === 201, 'gerente com "pagar" lança contestação')
  const mgrAdjDel = await req('DELETE', `/invoices/${invForPerm}/adjustments/${mgrAdjOk.data.id}`, { token: mgrT })
  ok(mgrAdjDel.status === 200, 'gerente remove a própria contestação (deixa a fatura limpa p/ o resto do teste)')

  // Revogar o "ver" derruba também o "pagar".
  const revokeView = await req('PUT', `/supermarket-members/${mkMember.data.id}`, { token: superT, body: { canViewInvoices: false } })
  ok(revokeView.status === 200 && revokeView.data.canViewInvoices === false && revokeView.data.canPayInvoices === false, 'revogar "ver" derruba também o "pagar"')
  const mgrBillingBlockedAgain = await req('GET', '/billing/summary', { token: mgrT })
  ok(mgrBillingBlockedAgain.status === 403, 'gerente volta a ser bloqueado depois da revogação')

  section('Contestação do fechamento (abatimento)')
  const invId = close.data.id
  const invTotal = Number(close.data.totalAmount)
  const adj1 = await req('POST', `/invoices/${invId}/adjustments`, { token: superT, body: { description: 'Quebra de caixa 12/03', amount: 10 } })
  ok(adj1.status === 201 && adj1.data.status === 'pending', 'supermercado lança contestação (pending)', adj1.data)
  const adj2 = await req('POST', `/invoices/${invId}/adjustments`, { token: superT, body: { description: 'Item indevido', amount: 5 } })
  ok(adj2.status === 201, 'segunda contestação lançada')

  const payBlocked = await req('POST', `/invoices/${invId}/pay`, { token: superT })
  ok(payBlocked.status === 400 && /contesta/i.test(payBlocked.data?.message || ''), 'pagamento bloqueado enquanto há contestação pendente', payBlocked.data?.message)

  const pcBefore = (await req('GET', '/agency/pending-counts', { token: agencyT })).data
  ok((pcBefore.contestationsToReview ?? 0) >= 2, 'pending-counts sinaliza contestações a revisar', pcBefore.contestationsToReview)

  const balBefore = Number((await db.query('SELECT available_balance FROM agencies WHERE id=$1', [agencyId])).rows[0].available_balance)
  const apprAdj = await req('POST', `/invoices/${invId}/adjustments/${adj1.data.id}/approve`, { token: agencyT })
  ok(apprAdj.status === 200 && apprAdj.data.status === 'approved', 'agência aprova o abatimento')
  const rejNoNote = await req('POST', `/invoices/${invId}/adjustments/${adj2.data.id}/reject`, { token: agencyT, body: {} })
  ok(rejNoNote.status === 400, 'recusa exige motivo')
  const rejAdj = await req('POST', `/invoices/${invId}/adjustments/${adj2.data.id}/reject`, { token: agencyT, body: { note: 'sem comprovação' } })
  ok(rejAdj.status === 200 && rejAdj.data.status === 'rejected', 'agência recusa a outra contestação (com motivo)')
  const balAfter = Number((await db.query('SELECT available_balance FROM agencies WHERE id=$1', [agencyId])).rows[0].available_balance)
  ok(Math.abs((balBefore - balAfter) - 10) < 0.01, 'saldo da agência cai o valor do abatimento aprovado', balBefore - balAfter)

  const billingAdj = (await req('GET', '/billing/summary', { token: superT })).data
  const invRow = billingAdj.invoices.find((i) => i.id === invId)
  ok(Number(invRow.adjustmentsTotal) === 10 && Math.abs(Number(invRow.netAmount) - (invTotal - 10)) < 0.01, 'faturamento mostra abatimento e valor líquido', invRow)

  const pdfAdj = await fetch(`${BASE}/closings/${invId}/pdf`, { headers: { Authorization: `Bearer ${agencyT}` } })
  const pdfAdjBuf = Buffer.from(await pdfAdj.arrayBuffer())
  ok(pdfAdj.ok && pdfAdjBuf.slice(0, 5).toString() === '%PDF-', 'PDF do fechamento gera com a seção de abatimentos')

  section('Pagamento da fatura pelo app configurável (chave-mestra + por cliente) + baixa manual')
  const disableSuperPay = await req('PUT', '/agency/settings', { token: agencyT, body: { appPaymentEnabledForSupermarkets: false } })
  ok(disableSuperPay.status === 200 && disableSuperPay.data.appPaymentEnabledForSupermarkets === false, 'agência desliga a chave-mestra do pagamento pelo app pros mercados')

  const payBlockedByToggle = await req('POST', `/invoices/${invId}/pay`, { token: superT })
  ok(payBlockedByToggle.status === 400 && /habilitad/i.test(payBlockedByToggle.data?.message || ''), 'mercado não paga com a chave-mestra desligada', payBlockedByToggle.data)

  const marketMarkPaidBlocked = await req('POST', `/invoices/${invId}/mark-paid`, { token: superT })
  ok(marketMarkPaidBlocked.status === 403, 'mercado não pode usar a baixa manual — só a agência', marketMarkPaidBlocked.status)

  const enableSuperPay = await req('PUT', '/agency/settings', { token: agencyT, body: { appPaymentEnabledForSupermarkets: true } })
  ok(enableSuperPay.status === 200 && enableSuperPay.data.appPaymentEnabledForSupermarkets === true, 'agência religa a chave-mestra')

  const disableClientPay = await req('PUT', `/supermarkets/${supermarketId}/app-payment`, { token: agencyT, body: { enabled: false } })
  ok(disableClientPay.status === 200 && disableClientPay.data.appPaymentEnabled === false, 'agência desliga o pagamento pelo app só pra este cliente')
  const payBlockedByClient = await req('POST', `/invoices/${invId}/pay`, { token: superT })
  ok(payBlockedByClient.status === 400, 'mercado não paga com o override do cliente desligado (mesmo com a chave-mestra ligada)', payBlockedByClient.data)

  const markPaidManually = await req('POST', `/invoices/${invId}/mark-paid`, { token: agencyT })
  ok(markPaidManually.status === 200 && markPaidManually.data.status === 'paid' && markPaidManually.data.paymentProvider === 'manual', 'agência dá baixa manual na fatura', markPaidManually.data)
  const markPaidTwice = await req('POST', `/invoices/${invId}/mark-paid`, { token: agencyT })
  ok(markPaidTwice.status === 400, 'baixa manual recusada numa fatura que já não está pendente', markPaidTwice.status)

  const enableClientPay = await req('PUT', `/supermarkets/${supermarketId}/app-payment`, { token: agencyT, body: { enabled: true } })
  ok(enableClientPay.status === 200 && enableClientPay.data.appPaymentEnabled === true, 'agência religa o pagamento pelo app pro cliente (deixa tudo ligado de novo pro resto do teste)')

  // Fatura já paga manualmente — cria uma segunda pra continuar com o fluxo normal de pagamento pelo app.
  const secondInvId = crypto.randomUUID()
  await db.query(
    `INSERT INTO invoices (id, supermarket_id, agency_id, type, reference_month, total_amount, adjustments_total, status, created_at, updated_at)
     VALUES ($1,$2,$3,'monthly',$4,50,0,'pending', NOW(), NOW())`,
    [secondInvId, supermarketId, agencyId, ref]
  )

  const payInv = await req('POST', `/invoices/${secondInvId}/pay`, { token: superT })
  ok(payInv.status === 200 && payInv.data.status === 'paid', 'supermercado paga a fatura mensal com o pagamento pelo app religado')
  // Item 11: rota de confirmação do pagamento via gateway (no-op quando já está paga).
  const syncInv = await req('POST', `/invoices/${secondInvId}/sync-payment`, { token: superT })
  ok(syncInv.status === 200 && syncInv.data.status === 'paid', 'rota de confirmação de pagamento da fatura responde', syncInv.data?.status)

  section('Relatório do freelancer')
  const report = (await req('GET', '/reports/freelancer', { token: freeT })).data
  ok(report.items.length >= 1 && report.totals.earned > 0, 'relatório com trabalhos e ganhos', report.totals)

  section('Avaliação do colaborador pelo supermercado + reputação')
  await db.query(`UPDATE jobs SET review_enabled = NULL WHERE id = $1`, [settledJob.id])
  await req('PUT', '/agency/settings', { token: agencyT, body: { reviewEnabled: false } })
  const revBlocked = await req('POST', `/jobs/${settledJob.id}/review-by-supermarket`, { token: superT, body: { rating: 5 } })
  ok(revBlocked.status === 400 && /habilit/i.test(revBlocked.data?.message || ''), 'sem reviewEnabled o supermercado não avalia', revBlocked.data?.message)

  await req('PUT', '/agency/settings', { token: agencyT, body: { reviewEnabled: true } })
  const revBad = await req('POST', `/jobs/${settledJob.id}/review-by-supermarket`, { token: superT, body: { rating: 9 } })
  ok(revBad.status === 400, 'nota fora de 1–5 recusada')
  const rev1 = await req('POST', `/jobs/${settledJob.id}/review-by-supermarket`, { token: superT, body: { rating: 5, comment: 'Ótimo atendimento' } })
  ok(rev1.status === 201 && rev1.data.authorRole === 'supermarket', 'supermercado avalia o colaborador da vaga', rev1.data)
  const revDup = await req('POST', `/jobs/${settledJob.id}/review-by-supermarket`, { token: superT, body: { rating: 4 } })
  ok(revDup.status === 400, 'segunda avaliação do supermercado na mesma vaga recusada')
  const revAgency = await req('POST', `/jobs/${settledJob.id}/review`, { token: agencyT, body: { rating: 4, approved: true } })
  ok(revAgency.status === 201, 'a agência ainda pode avaliar a mesma vaga (autor diferente)')

  const reputation = (await req('GET', `/freelancers/${free2Id}/reputation`, { token: agencyT })).data
  ok(Number(reputation.ratingCount) >= 2 && reputation.completedJobs >= 1 && reputation.workedMinutes > 0,
    'reputação: nota média + convocações concluídas + horas trabalhadas', reputation)
  ok(Array.isArray(reputation.reviews) && reputation.reviews.some((r) => r.authorRole === 'supermarket'),
    'reputação (agência) lista as avaliações individuais com o autor')

  // Visibilidade por papel: colaborador e supermercado só veem a MÉDIA (reviews vazio).
  const repFree = (await req('GET', `/freelancers/${free2Id}/reputation`, { token: free2T })).data
  ok(repFree.ratingAvg != null && Array.isArray(repFree.reviews) && repFree.reviews.length === 0,
    'colaborador recebe a nota média sem a lista de avaliações', repFree.reviews?.length)
  const jobReviewsSuper = await req('GET', `/jobs/${settledJob.id}/review`, { token: superT })
  ok(jobReviewsSuper.status === 200 && jobReviewsSuper.data.every((r) => r.authorRole === 'supermarket'),
    'supermercado só vê na vaga as avaliações que ele mesmo publicou', jobReviewsSuper.data?.map((r) => r.authorRole))
  const jobReviewsAgency = await req('GET', `/jobs/${settledJob.id}/review`, { token: agencyT })
  ok(jobReviewsAgency.status === 200 && jobReviewsAgency.data.length >= 2,
    'agência vê todas as avaliações da vaga', jobReviewsAgency.data?.length)
  const jobReviewsFree = await req('GET', `/jobs/${settledJob.id}/review`, { token: free2T })
  ok(jobReviewsFree.status === 400 || jobReviewsFree.status === 403, 'colaborador não acessa as avaliações da vaga', jobReviewsFree.status)
  const agencyReviews = await req('GET', '/agency/reviews', { token: agencyT })
  ok(agencyReviews.status === 200 && agencyReviews.data.some((r) => r.freelancerId === free2Id && r.freelancerName),
    'GET /agency/reviews lista as avaliações da rede com nome do colaborador', agencyReviews.data?.length)
  const agencyReviewsFiltered = await req('GET', `/agency/reviews?jobId=${settledJob.id}`, { token: agencyT })
  ok(agencyReviewsFiltered.status === 200 && agencyReviewsFiltered.data.every((r) => r.jobId === settledJob.id),
    'GET /agency/reviews filtra por vaga', agencyReviewsFiltered.data?.length)

  section('Onboarding do colaborador (perfil contratual + trava de trabalho)')
  await req('PUT', '/agency/settings', { token: agencyT, body: { onboardingRequired: true, uniformPrice: 80 } })
  const availLocked = (await req('GET', '/jobs/available', { token: freeT })).data
  ok(Array.isArray(availLocked) && availLocked.length === 0, 'com onboarding ligado e sem contrato: nenhuma vaga', availLocked.length)
  const openJob = (await req('GET', '/jobs', { token: agencyT })).data.find((j) => j.status === 'pending')
  const accLocked = await req('POST', `/jobs/${openJob.id}/accept`, { token: freeT })
  ok(accLocked.status === 400 && /perfil contratual/i.test(accLocked.data?.message || ''), 'aceite bloqueado sem perfil contratual', accLocked.data?.message)

  const contractBody = {
    fullName: 'Joana Freelancer', cpf: '123.456.789-09', rg: '12.345.678-9', pisNis: '123.45678.90-1',
    birthDate: '1995-05-10', maritalStatus: 'solteira', nationality: 'brasileira', motherName: 'Maria',
    addressCep: '01000-000', addressStreet: 'Rua A', addressNumber: '10', addressNeighborhood: 'Centro',
    addressCity: 'São Paulo', addressState: 'SP', bankName: 'Banco X', bankBranch: '0001', bankAccount: '12345-6',
    emergencyContactName: 'José', emergencyContactPhone: '(11) 99999-0000', shirtSize: 'M',
  }
  const ct = await req('PUT', '/freelancer/contract', { token: freeT, body: contractBody })
  ok(ct.status === 200 && ct.data.completedAt, 'perfil contratual concluído', ct.data?.completedAt)
  const accStillLocked = await req('POST', `/jobs/${openJob.id}/accept`, { token: freeT })
  ok(accStillLocked.status === 400 && /uniforme/i.test(accStillLocked.data?.message || ''), 'ainda bloqueado até o uniforme ser aprovado', accStillLocked.data?.message)

  section('Compra do uniforme pelo app configurável + baixa manual')
  const disableFreePay = await req('PUT', '/agency/settings', { token: agencyT, body: { appPaymentEnabledForFreelancers: false } })
  ok(disableFreePay.status === 200 && disableFreePay.data.appPaymentEnabledForFreelancers === false, 'agência desliga a compra de uniforme pelo app')

  const uniformNoGateway = await req('POST', '/freelancer/uniform', { token: freeT, body: { shirtSize: 'M' } })
  ok(
    uniformNoGateway.status === 201 && uniformNoGateway.data.status === 'pending_payment' && !uniformNoGateway.data.paymentUrl,
    'pedido de uniforme registrado sem link de pagamento (pagamento pelo app desligado)',
    uniformNoGateway.data
  )

  const uniformMarkBlocked = await req('POST', `/agency/uniforms/${uniformNoGateway.data.id}/mark-paid`, { token: freeT })
  ok(uniformMarkBlocked.status === 403, 'colaborador não pode dar baixa manual no próprio uniforme', uniformMarkBlocked.status)

  const uniformMarkPaid = await req('POST', `/agency/uniforms/${uniformNoGateway.data.id}/mark-paid`, { token: agencyT })
  ok(
    uniformMarkPaid.status === 200 && uniformMarkPaid.data.status === 'paid' && uniformMarkPaid.data.paymentProvider === 'manual',
    'agência dá baixa manual no uniforme',
    uniformMarkPaid.data
  )
  const uniformMarkPaidTwice = await req('POST', `/agency/uniforms/${uniformNoGateway.data.id}/mark-paid`, { token: agencyT })
  ok(uniformMarkPaidTwice.status === 400, 'baixa manual recusada num uniforme que já não está aguardando pagamento', uniformMarkPaidTwice.status)

  // Segue o fluxo normal de envio/revisão do uniforme, sem nenhuma mudança por causa da baixa manual.
  const uniformShip = await req('POST', `/agency/uniforms/${uniformNoGateway.data.id}/ship`, { token: agencyT, body: { trackingCode: 'BR123' } })
  ok(uniformShip.status === 200 && uniformShip.data.status === 'shipped', 'uniforme pago manualmente segue pro envio normalmente', uniformShip.data)

  await req('PUT', '/agency/settings', { token: agencyT, body: { appPaymentEnabledForFreelancers: true } })

  // Simula a aprovação do uniforme (o fluxo com Mercado Pago exige credenciais reais).
  await db.query(`UPDATE freelancers SET onboarding_approved_at = NOW() WHERE id = $1`, [freelancerId])
  const availOk = (await req('GET', '/jobs/available', { token: freeT })).data
  ok(availOk.length > 0, 'onboarding aprovado: vagas voltam a aparecer', availOk.length)
  await req('PUT', '/agency/settings', { token: agencyT, body: { onboardingRequired: false } })

  section('Convites da agência (supermercado e freelancer)')
  const inviteMarketRes = await req('POST', '/agency/invites', { token: agencyT, body: { role: 'supermarket' } })
  ok(inviteMarketRes.status === 201 && !!inviteMarketRes.data.token, 'convite de supermercado gerado')
  const inviteMarketToken = inviteMarketRes.data.token
  const previewMarket = await req('GET', `/invites/${inviteMarketToken}`)
  ok(previewMarket.status === 200 && previewMarket.data.agencyName === 'Agência Prime', 'prévia pública do convite traz o nome da agência', previewMarket.data)
  const regMarket = await req('POST', '/auth/register', {
    body: {
      name: 'Dono Mercado Convidado', email: `mercado-convite-${Date.now()}@email.com`, password: '123456',
      inviteToken: inviteMarketToken,
      profile: { companyName: 'Mercado Convidado', cnpj: validCnpj(), address: 'Rua Convite, 1' },
    },
  })
  ok(regMarket.status === 201 && regMarket.data.profile.agencyId === agencyId, 'supermercado cadastrado via convite já nasce vinculado à agência', regMarket.data)
  const reuseMarket = await req('POST', '/auth/register', {
    body: {
      name: 'Outro', email: `outro-${Date.now()}@email.com`, password: '123456', inviteToken: inviteMarketToken,
      profile: { companyName: 'X', cnpj: validCnpj(), address: 'Rua X' },
    },
  })
  ok(reuseMarket.status === 400, 'convite de supermercado não pode ser reaproveitado', reuseMarket.data)
  const openMarketReg = await req('POST', '/auth/register', {
    body: { name: 'Sem convite', email: `semconvite-${Date.now()}@email.com`, password: '123456', role: 'supermarket',
      profile: { companyName: 'X', cnpj: validCnpj(), address: 'Rua Y' } },
  })
  ok(openMarketReg.status === 400, 'autocadastro aberto de supermercado (sem convite) é recusado', openMarketReg.data)

  const inviteFreeRes = await req('POST', '/agency/invites', { token: agencyT, body: { role: 'freelancer' } })
  const regFree = await req('POST', '/auth/register', {
    body: {
      name: 'Colaborador Convidado', email: `colab-convite-${Date.now()}@email.com`, password: '123456',
      inviteToken: inviteFreeRes.data.token, profile: { document: validCpf() },
    },
  })
  ok(
    regFree.status === 201 && regFree.data.profile.registrationStatus === 'approved' && regFree.data.profile.agencyId === agencyId,
    'colaborador cadastrado via convite já nasce aprovado e vinculado à agência',
    regFree.data
  )
  section('Líderes de agência (AgencyMember)')
  const leaderInviteNoPay = await req('POST', '/agency/invites', { token: agencyT, body: { role: 'leader' } })
  ok(leaderInviteNoPay.status === 400, 'convite de líder exige forma/valor de pagamento', leaderInviteNoPay.data)
  const leaderInvite = await req('POST', '/agency/invites', {
    token: agencyT, body: { role: 'leader', payType: 'mensal', payAmount: 2500 },
  })
  ok(leaderInvite.status === 201 && !!leaderInvite.data.token, 'convite de líder gerado com pagamento', leaderInvite.data)
  const leaderEmail = `lider-${Date.now()}@email.com`
  const regLeader = await req('POST', '/auth/register', {
    body: { name: 'Líder Convidado', email: leaderEmail, password: '123456', inviteToken: leaderInvite.data.token },
  })
  ok(
    regLeader.status === 201 && regLeader.data.user.role === 'leader' && regLeader.data.profile.agencyId === agencyId,
    'líder cadastrado via convite: role leader + vinculado à agência',
    regLeader.data
  )
  const noInviteLeader = await req('POST', '/auth/register', {
    body: { name: 'X', email: `x-${Date.now()}@email.com`, password: '123456', role: 'leader' },
  })
  ok(noInviteLeader.status === 400, 'cadastro de líder sem convite é recusado', noInviteLeader.data)

  const leaderT = await login(leaderEmail)
  const meLeader = (await req('GET', '/auth/me', { token: leaderT })).data
  ok(
    meLeader.profile.role === 'leader' && meLeader.profile.payType === 'mensal' && Number(meLeader.profile.payAmount) === 2500,
    '/auth/me do líder traz agência e pagamento',
    meLeader.profile
  )

  const members = (await req('GET', '/agency/members', { token: agencyT })).data
  const leaderMember = members.find((m) => m.email === leaderEmail)
  ok(!!leaderMember && leaderMember.scope.freelancerIds.length === 0, 'líder aparece na lista da agência, sem escopo', leaderMember)

  // Cargo (tag) do líder: a agência define pela própria lista.
  const agRoles = (await req('GET', '/team-roles', { token: agencyT })).data
  const gerenteRole = agRoles.find((r) => r.name === 'Gerente')
  const setLeaderRole = await req('PUT', `/agency/members/${leaderMember.id}`, { token: agencyT, body: { teamRoleId: gerenteRole.id } })
  ok(setLeaderRole.status === 200 && setLeaderRole.data.teamRole?.name === 'Gerente', 'agência define o cargo do líder', setLeaderRole.data?.teamRole)
  const leaderRoleFromClient = await req('PUT', `/agency/members/${leaderMember.id}`, { token: agencyT, body: { teamRoleId: superRoles[0].id } })
  ok(leaderRoleFromClient.status === 400, 'cargo de outra lista (do supermercado) é recusado para o líder', leaderRoleFromClient.status)

  // Sem escopo: líder enxerga a rede toda.
  const freelancersAll = (await req('GET', '/freelancers', { token: leaderT })).data
  ok(Array.isArray(freelancersAll) && freelancersAll.length >= 2, 'líder sem escopo enxerga todos os colaboradores', freelancersAll.length)

  // Define escopo: só Joana (free1) + Filial Centro.
  const setScope = await req('PUT', `/agency/members/${leaderMember.id}/scope`, {
    token: agencyT, body: { freelancerIds: [freelancerId], branchIds: [branchCentro.id] },
  })
  ok(setScope.status === 200 && setScope.data.scope.freelancerIds.length === 1, 'agência define o escopo do líder', setScope.data.scope)

  const scopedFreelancers = (await req('GET', '/freelancers', { token: leaderT })).data
  ok(
    scopedFreelancers.length === 1 && scopedFreelancers[0].id === freelancerId,
    'líder com escopo só enxerga os colaboradores do grupo',
    scopedFreelancers.map((f) => f.name)
  )
  const scopedJobs = (await req('GET', '/jobs', { token: leaderT })).data
  ok(
    Array.isArray(scopedJobs) && scopedJobs.every((j) => j.branchId === branchCentro.id),
    'líder com escopo só enxerga vagas das filiais do grupo',
    scopedJobs.map((j) => j.branchId)
  )

  // Nada financeiro/contábil.
  ok((await req('PUT', '/agency/settings', { token: leaderT, body: { checkinRadius: 400 } })).status === 403, 'líder não altera configurações da agência')
  ok((await req('GET', `/closings/preview?supermarketId=${supermarketId}&referenceMonth=${dateInDays(0).slice(0, 7)}`, { token: leaderT })).status === 403, 'líder não acessa prévia de fechamento')
  ok((await req('GET', '/agency/pending-settlement', { token: leaderT })).status === 403, 'líder não acessa liberação de hora extra')
  ok((await req('GET', '/closings', { token: leaderT })).status === 403, 'líder não lista fechamentos')

  // Vaga fora do escopo de filial: líder não gerencia.
  await req('POST', `/supermarkets/${supermarketId}/rates`, { token: agencyT, body: { categoryId: catCaixa.id, branchId: branchSul.id, hourlyRate: 30 } })
  const outScopeOrder = await req('POST', '/orders', {
    token: superT, body: { items: [{ categoryId: catCaixa.id, branchId: branchSul.id, quantity: 1, shiftPeriod: 'manha', date: dateInDays(9) }] },
  })
  const outScopeJob = outScopeOrder.data.orderJobs[0]
  const outScopeEdit = await req('PUT', `/agency/jobs/${outScopeJob.id}`, { token: leaderT, body: { checkinRadius: 400 } })
  ok(outScopeEdit.status === 400 && /grupo de trabalho/i.test(outScopeEdit.data?.message || ''), 'líder não gerencia vaga fora do escopo de filial', outScopeEdit.data?.message)
  ok(!scopedJobs.some((j) => j.id === outScopeJob.id), 'vaga fora do escopo não aparece pro líder')

  // Vaga dentro do escopo: líder gerencia.
  const inScopeOrder = await req('POST', '/orders', {
    token: superT, body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: dateInDays(9), shifts: [{ startTime: '09:00', endTime: '13:00' }] }] },
  })
  const inScopeJob = inScopeOrder.data.orderJobs[0]
  const inScopeEdit = await req('PUT', `/agency/jobs/${inScopeJob.id}`, { token: leaderT, body: { checkinRadius: 350 } })
  ok(inScopeEdit.status === 200, 'líder gerencia vaga dentro do escopo', inScopeEdit.data?.message)

  // Líder cadastra colaborador — entra no escopo dele automaticamente.
  const leaderFreeEmail = `colab-lider-${Date.now()}@email.com`
  const leaderCreatesFree = await req('POST', '/agency/freelancers', {
    token: leaderT, body: { name: 'Colab do Líder', email: leaderFreeEmail, password: '123456' },
  })
  ok(leaderCreatesFree.status === 201, 'líder cadastra colaborador', leaderCreatesFree.data)
  const leaderFreeId = leaderCreatesFree.data.id
  const afterCreate = (await req('GET', '/freelancers', { token: leaderT })).data
  ok(afterCreate.some((f) => f.id === leaderFreeId), 'colaborador criado pelo líder entra no grupo dele')
  await req('POST', `/freelancers/${leaderFreeId}/categories`, { token: leaderT, body: { categoryId: catCaixa.id, hourlyRate: 19 } })

  // Reassign: alvo fora do escopo é recusado; dentro do escopo passa.
  await req('POST', `/jobs/${inScopeJob.id}/accept`, { token: freeT })
  const reassignOut = await req('POST', `/jobs/${inScopeJob.id}/reassign`, { token: leaderT, body: { freelancerId: free2Id } })
  ok(reassignOut.status === 400 && /grupo de trabalho/i.test(reassignOut.data?.message || ''), 'líder não troca para colaborador fora do escopo', reassignOut.data?.message)
  const reassignIn = await req('POST', `/jobs/${inScopeJob.id}/reassign`, { token: leaderT, body: { freelancerId: leaderFreeId } })
  ok(reassignIn.status === 200 && reassignIn.data.freelancerId === leaderFreeId, 'líder troca para colaborador do próprio grupo', reassignIn.data?.message)

  // Carteira do líder: agência credita (debita o saldo da agência), líder saca.
  const meAgencyBal = Number((await req('GET', '/auth/me', { token: agencyT })).data.profile.availableBalance ?? 0)
  const payAmt = Math.max(1, Math.min(Math.floor(meAgencyBal), 30))
  const payLeader = await req('POST', `/agency/members/${leaderMember.id}/payments`, {
    token: agencyT, body: { amount: payAmt, referenceMonth: '2099-01', note: 'smoke' },
  })
  ok(payLeader.status === 201 && Number(payLeader.data.availableBalance) === payAmt, 'agência credita a carteira do líder', payLeader.data?.availableBalance)
  const meAgencyBal2 = Number((await req('GET', '/auth/me', { token: agencyT })).data.profile.availableBalance ?? 0)
  ok(Math.abs(meAgencyBal2 - (meAgencyBal - payAmt)) < 0.01, 'pagamento ao líder debita o saldo da agência', { antes: meAgencyBal, depois: meAgencyBal2 })
  const payDup = await req('POST', `/agency/members/${leaderMember.id}/payments`, { token: agencyT, body: { amount: payAmt, referenceMonth: '2099-01' } })
  ok(payDup.status === 400, 'pagamento do mesmo mês de referência não pode repetir', payDup.data?.message)

  const leaderWallet = (await req('GET', '/leader/wallet', { token: leaderT })).data
  ok(Number(leaderWallet.availableBalance) === payAmt && leaderWallet.payments.length === 1, 'carteira do líder mostra saldo e créditos', leaderWallet)
  const wdNoPix = await req('POST', '/withdrawals', { token: leaderT, body: { amount: payAmt } })
  ok(wdNoPix.status === 400 && /pix/i.test(wdNoPix.data?.message || ''), 'saque sem chave Pix é recusado', wdNoPix.data?.message)
  const leaderWd = await req('POST', '/withdrawals', { token: leaderT, body: { amount: payAmt, pixKey: 'lider@pix.com', pixKeyType: 'email' } })
  ok(leaderWd.status === 201 && leaderWd.data.pixKey === 'lider@pix.com', 'líder solicita saque com chave Pix', leaderWd.data)
  const adminT = await login('admin@email.com')
  const wdList = (await req('GET', '/withdrawals?status=requested', { token: adminT })).data
  ok(
    Array.isArray(wdList) && wdList.some((w) => w.id === leaderWd.data.id && w.pixKey === 'lider@pix.com' && w.beneficiaryName),
    'admin lista os saques pendentes com chave Pix e nome do beneficiário para a baixa manual',
    wdList.find((w) => w.id === leaderWd.data.id)
  )
  const procWd = await req('POST', `/withdrawals/${leaderWd.data.id}/process`, { token: adminT, body: { status: 'paid' } })
  ok(procWd.status === 200 && procWd.data.status === 'paid', 'admin processa o saque do líder', procWd.data?.status)

  // --- Pagamento do líder "por colaborador que trabalhou" ---
  // Sem salário fixo: o líder ganha um valor por cada vaga que um colaborador do grupo dele
  // conclui. Conclusão normal -> crédito liberado na hora; desistência/troca -> pendente,
  // e a agência decide se libera ou não. Deltas relativos (a carteira já tem histórico).
  section('Líder pago por colaborador que trabalhou')
  const agencyBalanceOf = async () =>
    Number((await req('GET', `/agencies/${agencyId}`, { token: agencyT })).data.availableBalance)
  const leaderBalanceOf = async () =>
    Number((await req('GET', '/leader/wallet', { token: leaderT })).data.availableBalance)

  const setPerColab = await req('PUT', `/agency/members/${leaderMember.id}`, {
    token: agencyT, body: { payType: 'por_colaborador', payAmount: 12 },
  })
  ok(
    setPerColab.status === 200 && setPerColab.data.payType === 'por_colaborador' && Number(setPerColab.data.payAmount) === 12,
    'agência muda o líder para pagamento por colaborador (editável a qualquer momento)',
    setPerColab.data?.payType
  )

  const runShift = async (jobId, hoursBack) => {
    await req('POST', `/jobs/${jobId}/accept`, { token: freeT })
    await startShiftNow(jobId)
    await req('POST', `/jobs/${jobId}/logs/checkin`, { token: freeT, body: { ...CENTRO, accuracy: 10 } })
    const fd = new FormData()
    fd.append('photo', new Blob(['x'], { type: 'image/jpeg' }), 'p.jpg')
    await fetch(`${BASE}/jobs/${jobId}/photos`, { method: 'POST', headers: { Authorization: `Bearer ${freeT}` }, body: fd })
    await db.query(`UPDATE job_shifts SET check_in_at = check_in_at - interval '${hoursBack} hours' WHERE job_id=$1 AND status='in_progress'`, [jobId])
    await db.query(`UPDATE job_logs SET timestamp = timestamp - interval '${hoursBack} hours' WHERE job_id=$1 AND event_type='check-in'`, [jobId])
  }

  // (1) free1 (escopo do líder, Filial Centro) conclui a vaga normalmente -> crédito liberado.
  const pcOrder = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: dateInDays(12), shifts: [{ startTime: '09:00', endTime: '12:00' }] }] },
  })
  const pcJob = pcOrder.data.orderJobs[0]
  await runShift(pcJob.id, 3)
  const leaderBefore1 = await leaderBalanceOf()
  const agencyBefore1 = await agencyBalanceOf()
  const coPc = await req('POST', `/jobs/${pcJob.id}/logs/checkout`, { token: freeT, body: CENTRO })
  ok(coPc.status === 201 && coPc.data.jobCompleted === true, 'free1 conclui a vaga (por colaborador)')
  ok(Math.abs((await leaderBalanceOf()) - leaderBefore1 - 12) < 0.01, 'colaborador cumpriu a escala -> líder recebe R$ 12 na hora', (await leaderBalanceOf()) - leaderBefore1)
  ok(Math.abs((await agencyBalanceOf()) - agencyBefore1 - 24) < 1.5, 'crédito do líder debita o saldo da agência (margem 36 - 12)', (await agencyBalanceOf()) - agencyBefore1)
  const releasedList = (await req('GET', '/agency/member-credits?status=released', { token: agencyT })).data
  ok(releasedList.some((c) => c.jobId === pcJob.id && Number(c.amount) === 12), 'crédito liberado aparece em /agency/member-credits', releasedList.map((c) => c.jobId))

  // (2) free1 desiste no meio de outra vaga -> crédito do líder fica pendente de decisão.
  const pcOrder2 = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: dateInDays(12), shifts: [{ startTime: '15:00', endTime: '20:00' }] }] },
  })
  const pcJob2 = pcOrder2.data.orderJobs[0]
  await runShift(pcJob2.id, 2)
  const leaderBefore2 = await leaderBalanceOf()
  const quit2 = await req('POST', `/jobs/${pcJob2.id}/withdraw`, { token: freeT, body: { reason: 'imprevisto' } })
  ok(quit2.status === 200 && quit2.data.status === 'canceled', 'free1 desiste no meio do turno', quit2.data?.status)
  ok(Math.abs((await leaderBalanceOf()) - leaderBefore2) < 0.01, 'desistência não credita o líder na hora', (await leaderBalanceOf()) - leaderBefore2)
  const pendingList = (await req('GET', '/agency/member-credits?status=pending', { token: agencyT })).data
  const pendingCredit = pendingList.find((c) => c.jobId === pcJob2.id)
  ok(!!pendingCredit && pendingCredit.status === 'pending', 'crédito do líder por vaga com desistência fica pendente', pendingList.map((c) => c.jobId))
  const counts = (await req('GET', '/agency/pending-counts', { token: agencyT })).data
  ok((counts.memberCreditsToReview ?? 0) >= 1, 'pending-counts sinaliza créditos de líder a revisar', counts.memberCreditsToReview)

  // (3) agência libera o crédito pendente -> entra na carteira do líder.
  const relCredit = await req('POST', `/agency/member-credits/${pendingCredit.id}/release`, { token: agencyT })
  ok(relCredit.status === 200 && relCredit.data.status === 'released', 'agência libera o crédito pendente', relCredit.data?.status)
  ok(Math.abs((await leaderBalanceOf()) - leaderBefore2 - 12) < 0.01, 'liberação credita R$ 12 na carteira do líder', (await leaderBalanceOf()) - leaderBefore2)

  // (4) outra desistência -> a agência decide NÃO pagar.
  const pcOrder3 = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: dateInDays(13), shifts: [{ startTime: '09:00', endTime: '14:00' }] }] },
  })
  const pcJob3 = pcOrder3.data.orderJobs[0]
  await runShift(pcJob3.id, 2)
  await req('POST', `/jobs/${pcJob3.id}/withdraw`, { token: freeT, body: { reason: 'outro imprevisto' } })
  const pending3 = (await req('GET', '/agency/member-credits?status=pending', { token: agencyT })).data.find((c) => c.jobId === pcJob3.id)
  const leaderBefore3 = await leaderBalanceOf()
  const cancelCredit = await req('POST', `/agency/member-credits/${pending3.id}/cancel`, { token: agencyT, body: { note: 'não cumpriu a escala' } })
  ok(cancelCredit.status === 200 && cancelCredit.data.status === 'canceled', 'agência decide não pagar o crédito', cancelCredit.data?.status)
  ok(Math.abs((await leaderBalanceOf()) - leaderBefore3) < 0.01, 'crédito não pago não mexe na carteira do líder', (await leaderBalanceOf()) - leaderBefore3)

  // Líder desativado perde o acesso.
  await req('DELETE', `/agency/members/${leaderMember.id}`, { token: agencyT })
  ok((await req('GET', '/freelancers', { token: leaderT })).status === 403, 'líder desativado perde acesso às rotas operacionais')
  const meLeaderOff = (await req('GET', '/auth/me', { token: leaderT })).data
  ok(meLeaderOff.profile?.active === false, '/auth/me do líder desativado sinaliza acesso suspenso', meLeaderOff.profile)

  section('Filial cadastrada pelo supermercado fica pendente até a agência aprovar')
  const newBranch = await req('POST', '/branches', {
    token: superT,
    body: { name: 'Filial Nova', address: TEST_ADDRESS, latitude: CENTRO.latitude, longitude: CENTRO.longitude },
  })
  ok(newBranch.status === 201 && newBranch.data.serviceStatus === 'pending', 'filial criada pelo supermercado nasce pendente', newBranch.data.serviceStatus)
  const countsPending = await req('GET', '/agency/pending-counts', { token: agencyT })
  ok(countsPending.status === 200 && countsPending.data.branchesToApprove >= 1, 'filial pendente entra em pending-counts da agência', countsPending.data)
  const blockedOrder = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catCaixa.id, branchId: newBranch.data.id, quantity: 1, shiftPeriod: 'manha', date: day }] },
  })
  ok(blockedOrder.status === 400 && /aprovada/i.test(blockedOrder.data?.message || ''), 'pedido bloqueado pra filial ainda não aprovada', blockedOrder.data?.message)
  const approveBranch = await req('POST', `/branches/${newBranch.data.id}/approve`, { token: agencyT })
  ok(approveBranch.status === 200 && approveBranch.data.serviceStatus === 'approved', 'agência aprova o atendimento da filial')
  const countsAfter = await req('GET', '/agency/pending-counts', { token: agencyT })
  ok(countsAfter.status === 200 && countsAfter.data.branchesToApprove === 0, 'pending-counts zera depois da aprovação', countsAfter.data)
  // Precisa de valor/hora pra essa loja+função antes do pedido passar (mesma regra de sempre).
  await req('POST', `/supermarkets/${supermarketId}/rates`, {
    token: agencyT, body: { categoryId: catCaixa.id, branchId: newBranch.data.id, hourlyRate: 32 },
  })
  const unblockedOrder = await req('POST', '/orders', {
    token: superT,
    body: { items: [{ categoryId: catCaixa.id, branchId: newBranch.data.id, quantity: 1, shiftPeriod: 'manha', date: day }] },
  })
  ok(unblockedOrder.status === 201, 'pedido passa a funcionar depois da aprovação', unblockedOrder.data)

  section('Isolamento entre agências — sem pool aberto')
  const otherAgencyEmail = `outra-agencia-${Date.now()}@email.com`
  const otherAgencyReg = await req('POST', '/auth/register', {
    body: {
      name: 'Outra Agência', email: otherAgencyEmail, password: '123456', role: 'agency',
      profile: { companyName: 'Agência Rival', cnpj: validCnpj(), address: 'Rua Rival, 1' },
    },
  })
  const otherAgencyT = await login(otherAgencyEmail)
  const otherAgencyId = otherAgencyReg.data.profile.id
  const jobsForOtherAgency = (await req('GET', '/jobs', { token: otherAgencyT })).data
  ok(Array.isArray(jobsForOtherAgency) && jobsForOtherAgency.length === 0, 'agência nova não vê nenhuma vaga da Agência Prime', jobsForOtherAgency.length)

  const otherFreeEmail = `outro-free-${Date.now()}@email.com`
  await req('PUT', '/agency/settings', { token: otherAgencyT, body: { allowSelfRegistration: true } })
  const otherFreeReg = await req('POST', '/auth/register', {
    body: {
      name: 'Freelancer Rival', email: otherFreeEmail, password: '123456', role: 'freelancer',
      profile: { agencyId: otherAgencyId, document: validCpf() },
    },
  })
  ok(otherFreeReg.status === 201, 'freelancer da agência rival cadastrado')
  await db.query(`UPDATE freelancers SET registration_status = 'approved' WHERE email = $1`, [otherFreeEmail])
  await db.query(
    `INSERT INTO freelancer_categories (id, freelancer_id, category_id, hourly_rate, created_at, updated_at)
     VALUES ($1, (SELECT id FROM freelancers WHERE email = $2), $3, 20, NOW(), NOW())`,
    [crypto.randomUUID(), otherFreeEmail, catCaixa.id]
  )
  const otherFreeT = await login(otherFreeEmail)
  const availOtherAgency = (await req('GET', '/jobs/available', { token: otherFreeT })).data
  ok(
    Array.isArray(availOtherAgency) && availOtherAgency.length === 0,
    'freelancer da agência rival não vê vagas do Mercado Central (cliente de outra agência)',
    availOtherAgency.length
  )

  section('Geocodificação (tolerante a rede)')
  const geo = await req('POST', '/branches/geocode', { token: superT, body: { address: TEST_ADDRESS } })
  ok(geo.status === 200 || geo.status === 400, `geocode respondeu (${geo.status})`, geo.status === 200 ? { lat: geo.data.latitude } : geo.data?.message)

  section('Cadastro de agência pelo admin + perfis institucionais')
  const adminTok = await login('admin@email.com')
  const newAgEmail = `nova-agencia-${Date.now()}@x.com`
  const createAg = await req('POST', '/platform/agencies', { token: adminTok, body: {
    name: 'Agência Console', legalName: 'Console Servicos Ltda', cnpj: validCnpj(),
    address: TEST_ADDRESS, ownerEmail: newAgEmail, ownerName: 'Dono Console', password: '123456',
  } })
  ok(createAg.status === 201 && !!createAg.data.agency?.id, 'admin cadastra agência via /platform/agencies', createAg.data?.message)
  ok(!!(await login(newAgEmail)), 'login do dono da nova agência funciona')
  const newAgToken = await login(newAgEmail)
  const dupCnpj = await req('POST', '/platform/agencies', { token: adminTok, body: {
    name: 'X', cnpj: createAg.data.agency.cnpj, address: 'a', ownerEmail: `x-${Date.now()}@x.com`, ownerName: 'X', password: '1234',
  } })
  ok(dupCnpj.status === 400, 'CNPJ de agência duplicado é recusado')
  ok((await req('GET', '/platform/agencies', { token: agencyT })).status === 403, 'agência comum não acessa /platform/agencies (só admin)')

  section('Validação de campos tipados nos cadastros (documento, e-mail, telefone)')
  const badCnpj = await req('POST', '/platform/agencies', { token: adminTok, body: {
    name: 'Y', cnpj: '11111111111111', address: 'a', ownerEmail: `y-${Date.now()}@x.com`, ownerName: 'Y', password: '1234',
  } })
  ok(badCnpj.status === 400 && /CNPJ/i.test(badCnpj.data?.message || ''), 'CNPJ com dígito verificador inválido é recusado', badCnpj.data?.message)
  const badEmail = await req('POST', '/platform/agencies', { token: adminTok, body: {
    name: 'Z', cnpj: validCnpj(), address: 'a', ownerEmail: 'sem-arroba', ownerName: 'Z', password: '1234',
  } })
  ok(badEmail.status === 400 && /e-mail/i.test(badEmail.data?.message || ''), 'e-mail do responsável malformado é recusado', badEmail.data?.message)
  const maskedCnpj = validCnpj()
  const fmtCnpj = `${maskedCnpj.slice(0, 2)}.${maskedCnpj.slice(2, 5)}.${maskedCnpj.slice(5, 8)}/${maskedCnpj.slice(8, 12)}-${maskedCnpj.slice(12)}`
  const normAg = await req('POST', '/platform/agencies', { token: adminTok, body: {
    name: 'Normalizada', cnpj: fmtCnpj, address: TEST_ADDRESS, ownerEmail: `norm-${Date.now()}@x.com`,
    ownerName: 'Norm', password: '123456', phone: '(54) 99999-8877',
  } })
  ok(normAg.status === 201 && normAg.data.agency.cnpj === maskedCnpj, 'CNPJ com máscara é salvo só com dígitos', normAg.data?.agency?.cnpj)
  const badFreeDoc = await req('POST', '/auth/register', {
    body: { name: 'Doc Ruim', email: `docruim-${Date.now()}@x.com`, password: '123456',
      inviteToken: (await req('POST', '/agency/invites', { token: agencyT, body: { role: 'freelancer' } })).data.token,
      profile: { document: '12345678900' } },
  })
  ok(badFreeDoc.status === 400 && /CPF/i.test(badFreeDoc.data?.message || ''), 'CPF de colaborador inválido é recusado no cadastro por convite', badFreeDoc.data?.message)

  const putAgProfile = await req('PUT', '/agency/profile', { token: newAgToken, body: { legalName: 'Console Servicos S.A.', email: 'contato@console.com' } })
  ok(putAgProfile.status === 200 && putAgProfile.data.legalName === 'Console Servicos S.A.', 'agência edita o próprio perfil (razão social/e-mail)')
  ok((await req('GET', '/auth/me', { token: newAgToken })).data.profile.email === 'contato@console.com', '/auth/me reflete o perfil da agência')

  section('Ordem personalizada do menu lateral (agência e supermercado)')
  const setAgOrder = await req('PUT', '/agency/settings', { token: agencyT, body: { sidebarOrder: ['/agency/payments', '/agency/dashboard'] } })
  ok(setAgOrder.status === 200 && setAgOrder.data.sidebarOrder?.[0] === '/agency/payments', 'agência salva a ordem personalizada do menu', setAgOrder.data?.sidebarOrder)
  ok((await req('GET', '/agency/settings', { token: agencyT })).data.sidebarOrder?.[0] === '/agency/payments', 'GET /agency/settings reflete a ordem salva')
  const clearAgOrder = await req('PUT', '/agency/settings', { token: agencyT, body: { sidebarOrder: null } })
  ok(clearAgOrder.status === 200 && clearAgOrder.data.sidebarOrder === null, 'agência restaura a ordem padrão (null)')

  const setMkOrderBlocked = await req('PUT', '/supermarket/sidebar-order', { token: mgrT, body: { sidebarOrder: ['/supermarket/payments'] } })
  ok(setMkOrderBlocked.status === 403, 'gerente (não-dono) não reordena o menu do supermercado')
  const setMkOrder = await req('PUT', '/supermarket/sidebar-order', { token: superT, body: { sidebarOrder: ['/supermarket/jobs', '/supermarket/dashboard'] } })
  ok(setMkOrder.status === 200 && setMkOrder.data.sidebarOrder?.[0] === '/supermarket/jobs', 'dono do supermercado salva a ordem personalizada do menu', setMkOrder.data)
  ok((await req('GET', '/auth/me', { token: superT })).data.profile.sidebarOrder?.[0] === '/supermarket/jobs', '/auth/me reflete a ordem salva do supermercado')

  await req('PUT', `/platform/agencies/${createAg.data.agency.id}`, { token: adminTok, body: { active: false } })
  ok((await req('POST', '/auth/login', { body: { email: newAgEmail, password: '123456' } })).status === 403, 'agência desativada pelo admin não consegue logar')
  await req('PUT', `/platform/agencies/${createAg.data.agency.id}`, { token: adminTok, body: { active: true } })

  await req('PUT', `/supermarkets/${supermarketId}/profile`, { token: superT, body: { legalName: 'Central Matriz Ltda' } })
  const brProfile = (await req('GET', `/branches/${branchCentro.id}/profile`, { token: superT })).data
  ok(brProfile.profile.legalName === 'Central Matriz Ltda' && brProfile.profile.inherited.includes('legalName'), 'filial sem razão social herda a da matriz')
  await req('PUT', `/branches/${branchCentro.id}/profile`, { token: superT, body: { cnpj: '12345678000195' } })
  const brProfile2 = (await req('GET', `/branches/${branchCentro.id}/profile`, { token: superT })).data
  ok(brProfile2.profile.cnpj === '12345678000195' && !brProfile2.profile.inherited.includes('cnpj'), 'CNPJ próprio da filial deixa de ser herdado')

  section('Contrato eletrônico do colaborador')
  const free2Tok = await login('free2@email.com')
  const tpls = (await req('GET', '/agency/contract-templates', { token: agencyT })).data
  ok(tpls.templates.some((t) => t.active) && tpls.tokens.length > 0, 'agência tem modelo de contrato ativo + campos de mesclagem')
  const agreement = (await req('GET', '/freelancer/contract/agreement', { token: free2Tok })).data
  ok(agreement.hasTemplate && agreement.canSign && agreement.missing.length === 0, 'colaborador com onboarding aprovado pode assinar', agreement.blockedReason)
  const signRes = await req('POST', '/freelancer/contract/sign', { token: free2Tok, body: { accepted: true } })
  ok(signRes.status === 201 && /^[0-9a-f]{64}$/.test(signRes.data.contentHash || ''), 'contrato assinado com hash SHA-256', signRes.data)
  ok(!!signRes.data.ipAddress, 'assinatura registra o IP do signatário')
  ok((await req('POST', '/freelancer/contract/sign', { token: free2Tok, body: { accepted: false } })).status === 400, 'assinatura sem marcar o aceite é recusada')
  const agencySigs = (await req('GET', '/agency/contract-signatures', { token: agencyT })).data
  ok(agencySigs.some((s) => s.id === signRes.data.id && s.freelancer), 'agência vê a assinatura do colaborador (com o nome dele)')
  const verify = (await req('GET', `/contracts/verify/${signRes.data.id}`)).data
  ok(verify.contentHash === signRes.data.contentHash && /\*\*\*/.test(verify.signerCpfMasked || ''), 'verificação pública confere o hash e mascara o CPF')
  const docRes = await fetch(BASE + '/freelancer/contract/document', { headers: { Authorization: `Bearer ${free2Tok}` } })
  const docBuf = Buffer.from(await docRes.arrayBuffer())
  ok(docRes.status === 200 && docBuf.slice(0, 4).toString() === '%PDF' && docBuf.length > 1000, 'PDF do contrato assinado é gerado (> 1 KB)', docBuf.length)
  const activeTpl = tpls.templates.find((t) => t.active)
  await req('PUT', `/agency/contract-templates/${activeTpl.id}`, { token: agencyT, body: { bodyHtml: `${activeTpl.bodyHtml}<p>Clausula adicional {{dataAtual}}.</p>` } })
  const agreement2 = (await req('GET', '/freelancer/contract/agreement', { token: free2Tok })).data
  ok(agreement2.canSign && agreement2.supersededSignature, 'modelo alterado libera nova assinatura e marca a anterior como superada')
  const sign2 = await req('POST', '/freelancer/contract/sign', { token: free2Tok, body: { accepted: true } })
  ok(sign2.status === 201 && sign2.data.id !== signRes.data.id && sign2.data.contentHash !== signRes.data.contentHash, 'nova assinatura cria uma segunda linha (histórico preservado)')

  section('Alertas de ocorrência nas vagas (atraso, falta, vaga descoberta…)')
  const alertAdminT = await login('admin@email.com')
  const sweep = () => req('POST', '/internal/alerts/sweep', { token: alertAdminT })
  const agAlerts = async (qs = '') => (await req('GET', `/alerts${qs}`, { token: agencyT })).data
  const superAlerts = async () => (await req('GET', '/alerts', { token: superT })).data
  const backdate = (jobId, mins, spanMin = 240) =>
    Promise.all([
      db.query(
        `UPDATE job_shifts SET start_time = NOW() - ($2 || ' minutes')::interval,
           end_time = NOW() - ($2 || ' minutes')::interval + ($3 || ' minutes')::interval
         WHERE job_id = $1`,
        [jobId, String(mins), String(spanMin)]
      ),
      db.query(
        `UPDATE jobs SET start_time = NOW() - ($2 || ' minutes')::interval,
           end_time = NOW() - ($2 || ' minutes')::interval + ($3 || ' minutes')::interval WHERE id = $1`,
        [jobId, String(mins), String(spanMin)]
      ),
    ])
  const mkAlertJob = async (d) => {
    const o = await req('POST', '/orders', {
      token: superT,
      body: { items: [{ categoryId: catCaixa.id, branchId: branchCentro.id, quantity: 1, date: dateInDays(d), shifts: [{ startTime: '08:00', endTime: '12:00' }] }] },
    })
    return { orderId: o.data.id, job: o.data.orderJobs[0] }
  }

  // Vaga descoberta com o turno já começado.
  const unf = await mkAlertJob(20)
  await backdate(unf.job.id, 40, 300)
  await sweep()
  const unfAlert = (await agAlerts('?status=open')).find((a) => a.jobId === unf.job.id && a.type === 'shift_unfilled_started')
  ok(!!unfAlert && unfAlert.severity === 'critical', 'vaga descoberta após o início gera alerta crítico', unfAlert?.severity)
  ok((await superAlerts()).some((a) => a.jobId === unf.job.id), 'supermercado vê o alerta de vaga descoberta (afeta a entrega)')

  // Aceitar resolve o alerta de vaga descoberta (turno reposicionado para "começa agora").
  await req('POST', `/jobs/${unf.job.id}/accept`, { token: freeT })
  await backdate(unf.job.id, 2, 300)
  await sweep()
  ok(
    (await agAlerts('?status=all')).find((a) => a.jobId === unf.job.id && a.type === 'shift_unfilled_started')?.status === 'resolved',
    'aceitar a vaga resolve o alerta de vaga descoberta'
  )

  // Atraso no check-in + escalonamento para crítico.
  await backdate(unf.job.id, 20, 260)
  await sweep()
  let late = (await agAlerts('?status=open')).find((a) => a.jobId === unf.job.id && a.type === 'late_checkin')
  ok(!!late && late.severity === 'warning', 'atraso de 20 min no check-in gera alerta de atenção', late?.severity)
  await backdate(unf.job.id, 45, 260)
  await sweep()
  late = (await agAlerts('?status=open')).find((a) => a.jobId === unf.job.id && a.type === 'late_checkin')
  ok(!!late && late.severity === 'critical', 'atraso passa de 30 min -> alerta escala para crítico', late?.severity)

  // Reconhecer + resolver manualmente.
  const ackRes = await req('POST', `/alerts/${late.id}/acknowledge`, { token: agencyT })
  ok(ackRes.status === 200 && ackRes.data.status === 'acknowledged', 'agência reconhece a ocorrência')
  const resRes = await req('POST', `/alerts/${late.id}/resolve`, { token: agencyT, body: { note: 'falei com o colaborador' } })
  ok(
    resRes.status === 200 && resRes.data.status === 'resolved' && resRes.data.resolutionNote === 'falei com o colaborador',
    'agência resolve a ocorrência com nota'
  )
  await req('POST', `/jobs/${unf.job.id}/release`, { token: agencyT, body: { reason: 'teste de alerta' } })

  // Falta (no-show) + auto-resolução ao registrar.
  const ns = await mkAlertJob(21)
  await req('POST', `/jobs/${ns.job.id}/accept`, { token: freeT })
  await backdate(ns.job.id, 240, 180) // turno inteiro no passado
  await sweep()
  const nsAlert = (await agAlerts('?status=open')).find((a) => a.jobId === ns.job.id && a.type === 'no_show')
  ok(!!nsAlert && nsAlert.severity === 'critical', 'colaborador não apareceu e a janela acabou -> alerta de falta', nsAlert?.severity)
  await req('POST', `/jobs/${ns.job.id}/no-show`, { token: agencyT, body: { reason: 'não compareceu' } })
  const nsAll = await agAlerts('?status=all')
  ok(nsAll.find((a) => a.jobId === ns.job.id && a.type === 'no_show')?.status === 'resolved', 'registrar a falta resolve o alerta de falta')
  ok(nsAll.some((a) => a.jobId === ns.job.id && a.type === 'no_show_confirmed'), 'a falta confirmada fica registrada para auditoria')

  // A agência pode ocultar do supermercado.
  await req('PUT', '/agency/settings', { token: agencyT, body: { notifySupermarketOnAlerts: false } })
  const hid = await mkAlertJob(22)
  await backdate(hid.job.id, 30, 300)
  await sweep()
  ok((await agAlerts('?status=open')).some((a) => a.jobId === hid.job.id), 'agência ainda vê a ocorrência com o aviso do supermercado desligado')
  ok(!(await superAlerts()).some((a) => a.jobId === hid.job.id), 'supermercado não recebe ocorrências quando a agência desliga o aviso')
  await req('PUT', '/agency/settings', { token: agencyT, body: { notifySupermarketOnAlerts: true } })

  // Contadores no menu.
  const alertCounts = (await req('GET', '/agency/pending-counts', { token: agencyT })).data
  ok(
    typeof alertCounts.alertsOpen === 'number' && typeof alertCounts.alertsCritical === 'number',
    'pending-counts da agência traz alertsOpen/alertsCritical',
    { open: alertCounts.alertsOpen, critical: alertCounts.alertsCritical }
  )

  section('Política de e-mail de login + reset de senha pela agência')
  const loginEmailOfFreelancer = async (freelancerId) => {
    const r = await db.query(
      `SELECT u.email, u.contact_email AS "contactEmail" FROM freelancers f JOIN users u ON u.id = f.user_id WHERE f.id = $1`,
      [freelancerId]
    )
    return r.rows[0]
  }

  const settingsBefore = (await req('GET', '/agency/settings', { token: agencyT })).data
  ok(settingsBefore.loginEmailPolicy === 'informed', 'política de e-mail de login nasce como "informed"', settingsBefore.loginEmailPolicy)

  const patternOn = await req('PUT', '/agency/settings', { token: agencyT, body: { loginEmailPolicy: 'pattern' } })
  ok(patternOn.status === 200 && patternOn.data.loginEmailPolicy === 'pattern', 'agência liga o padrão nomesobrenome@workflow.com')

  const patternSuffix = Date.now()
  const patternFullName = `Renata Oliveira${patternSuffix}`
  const expectedPatternEmail = `renataoliveira${patternSuffix}@workflow.com`
  const patternFree1Informed = `renata-informado-${patternSuffix}@email.com`
  const patternFree1 = await req('POST', '/agency/freelancers', {
    token: agencyT, body: { name: patternFullName, email: patternFree1Informed, password: '123456' },
  })
  ok(patternFree1.status === 201, 'colaborador cadastrado com a política padrão ligada', patternFree1.data)
  const loginRow1 = await loginEmailOfFreelancer(patternFree1.data.id)
  ok(loginRow1?.email === expectedPatternEmail, 'login gerado como nomesobrenome@workflow.com', loginRow1)
  ok(loginRow1?.contactEmail === patternFree1Informed, 'e-mail informado no cadastro fica guardado em contactEmail', loginRow1)

  // Mesmo nome de novo -> colisão resolvida com sufixo numérico antes do @.
  const patternFree2 = await req('POST', '/agency/freelancers', {
    token: agencyT, body: { name: patternFullName, email: `renata-informado2-${patternSuffix}@email.com`, password: '123456' },
  })
  const loginRow2 = await loginEmailOfFreelancer(patternFree2.data.id)
  ok(
    loginRow2?.email === `renataoliveira${patternSuffix}2@workflow.com`,
    'colisão de e-mail padrão é resolvida com sufixo numérico',
    loginRow2
  )

  // Cadastro via convite também respeita a política da agência.
  const patternInvite = await req('POST', '/agency/invites', { token: agencyT, body: { role: 'freelancer' } })
  const patternInviteName = `Bruno Almeida${patternSuffix}`
  const patternInviteReg = await req('POST', '/auth/register', {
    body: {
      name: patternInviteName, email: `bruno-informado-${patternSuffix}@email.com`, password: '123456',
      inviteToken: patternInvite.data.token, profile: { document: validCpf() },
    },
  })
  ok(
    patternInviteReg.status === 201 && patternInviteReg.data.user.email === `brunoalmeida${patternSuffix}@workflow.com`,
    'cadastro via convite também usa o padrão de e-mail quando a política está ligada',
    patternInviteReg.data.user?.email
  )

  // Voltando pra "informed", novos cadastros usam o e-mail informado (sem regressão).
  await req('PUT', '/agency/settings', { token: agencyT, body: { loginEmailPolicy: 'informed' } })
  const informedFreeEmail = `carla-informado-${patternSuffix}@email.com`
  const informedFree = await req('POST', '/agency/freelancers', {
    token: agencyT, body: { name: `Carla Souza${patternSuffix}`, email: informedFreeEmail, password: '123456' },
  })
  const loginRow3 = await loginEmailOfFreelancer(informedFree.data.id)
  ok(loginRow3?.email === informedFreeEmail, 'com a política "informed", o login volta a ser o e-mail informado', loginRow3)

  // A agência redefine a senha do colaborador com login padrão e consegue logar com ela.
  const resetRes = await req('POST', `/freelancers/${patternFree1.data.id}/reset-password`, { token: agencyT })
  ok(
    resetRes.status === 200 && resetRes.data.email === expectedPatternEmail && !!resetRes.data.password,
    'agência redefine a senha do colaborador e recebe e-mail + senha nova',
    resetRes.data
  )
  const loginAfterReset = await req('POST', '/auth/login', { body: { email: resetRes.data.email, password: resetRes.data.password } })
  ok(loginAfterReset.status === 200, 'colaborador consegue logar com a senha redefinida pela agência', loginAfterReset.data)

  // Sócio sem a permissão "colaboradores" é barrado; sócio com acesso total (padrão) consegue.
  const noPermPartnerEmail = `socio-sem-permissao-${patternSuffix}@email.com`
  const noPermPartner = await req('POST', '/agency/partners', {
    token: agencyT,
    body: {
      name: 'Sócio Sem Permissão', email: noPermPartnerEmail, password: '123456',
      permissions: { vagas: true, clientes: true, colaboradores: false, financeiro: true, equipe: true, configuracoes: true },
    },
  })
  ok(noPermPartner.status === 201, 'sócio sem a permissão "colaboradores" cadastrado', noPermPartner.data)
  const noPermPartnerT = await login(noPermPartnerEmail)
  const deniedReset = await req('POST', `/freelancers/${informedFree.data.id}/reset-password`, { token: noPermPartnerT })
  ok(deniedReset.status === 403, 'sócio sem a permissão "colaboradores" é barrado ao tentar redefinir senha', deniedReset.data)

  const withPermPartnerEmail = `socio-com-permissao-${patternSuffix}@email.com`
  await req('POST', '/agency/partners', {
    token: agencyT, body: { name: 'Sócio Com Permissão', email: withPermPartnerEmail, password: '123456' },
  })
  const withPermPartnerT = await login(withPermPartnerEmail)
  const allowedReset = await req('POST', `/freelancers/${informedFree.data.id}/reset-password`, { token: withPermPartnerT })
  ok(allowedReset.status === 200, 'sócio com acesso total (padrão) consegue redefinir a senha', allowedReset.data)

  console.log(`\n----------\n${pass} passaram, ${fail} falharam`)
  await db.end()
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error('\nERRO FATAL:', e)
  try { await db.end() } catch {}
  process.exit(1)
})
