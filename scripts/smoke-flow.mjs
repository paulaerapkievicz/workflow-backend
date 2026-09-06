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
  const upd = await req('PUT', '/agency/settings', { token: agencyT, body: { checkinRadius: 250, cancellationWindowMinutes: 45 } })
  ok(upd.status === 200 && upd.data.checkinRadius === 250 && upd.data.cancellationWindowMinutes === 45, 'settings atualizadas')
  await req('PUT', '/agency/settings', { token: agencyT, body: { checkinRadius: 300, cancellationWindowMinutes: 30, requireCheckoutPhoto: true } })

  section('Valores/hora do supermercado')
  const cats = (await req('GET', '/categories', { token: superT })).data
  const catCaixa = cats.find((c) => c.name === 'Operador de Caixa')
  const catRepositor = cats.find((c) => c.name === 'Repositor')
  const catPadeiro = cats.find((c) => c.name === 'Padeiro')
  const rates = (await req('GET', `/supermarkets/${supermarketId}/rates`, { token: agencyT })).data
  const rateCaixa = rates.find((r) => r.categoryId === catCaixa.id && !r.branchId)
  ok(Number(rateCaixa.hourlyRate) === 32, 'valor/hora Operador de Caixa (padrão) = 32', rateCaixa?.hourlyRate)
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
    body: { name: 'Gerente Zona Sul', email: mgrEmail, password: '123456', branchId: branchSul.id, canApproveOrders: false },
  })
  ok(mkMember.status === 201, 'dono cadastra gerente de loja')
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

  section('Editar / remover vaga ainda disponível')
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

  const payInv = await req('POST', `/invoices/${close.data.id}/pay`, { token: superT })
  ok(payInv.status === 200 && payInv.data.status === 'paid', 'supermercado paga a fatura mensal')
  // Item 11: rota de confirmação do pagamento via gateway (no-op quando já está paga).
  const syncInv = await req('POST', `/invoices/${close.data.id}/sync-payment`, { token: superT })
  ok(syncInv.status === 200 && syncInv.data.status === 'paid', 'rota de confirmação de pagamento da fatura responde', syncInv.data?.status)

  section('Relatório do freelancer')
  const report = (await req('GET', '/reports/freelancer', { token: freeT })).data
  ok(report.items.length >= 1 && report.totals.earned > 0, 'relatório com trabalhos e ganhos', report.totals)

  section('Onboarding do colaborador (perfil contratual + trava de trabalho)')
  await req('PUT', '/agency/settings', { token: agencyT, body: { onboardingRequired: true, uniformPrice: 80 } })
  const availLocked = (await req('GET', '/jobs/available', { token: freeT })).data
  ok(Array.isArray(availLocked) && availLocked.length === 0, 'com onboarding ligado e sem contrato: nenhuma vaga', availLocked.length)
  const openJob = (await req('GET', '/jobs', { token: agencyT })).data.find((j) => j.status === 'pending')
  const accLocked = await req('POST', `/jobs/${openJob.id}/accept`, { token: freeT })
  ok(accLocked.status === 400 && /perfil contratual/i.test(accLocked.data?.message || ''), 'aceite bloqueado sem perfil contratual', accLocked.data?.message)

  const contractBody = {
    fullName: 'Joana Freelancer', cpf: '123.456.789-00', rg: '12.345.678-9', pisNis: '123.45678.90-1',
    birthDate: '1995-05-10', maritalStatus: 'solteira', nationality: 'brasileira', motherName: 'Maria',
    addressCep: '01000-000', addressStreet: 'Rua A', addressNumber: '10', addressNeighborhood: 'Centro',
    addressCity: 'São Paulo', addressState: 'SP', bankName: 'Banco X', bankBranch: '0001', bankAccount: '12345-6',
    emergencyContactName: 'José', emergencyContactPhone: '(11) 99999-0000', shirtSize: 'M',
  }
  const ct = await req('PUT', '/freelancer/contract', { token: freeT, body: contractBody })
  ok(ct.status === 200 && ct.data.completedAt, 'perfil contratual concluído', ct.data?.completedAt)
  const accStillLocked = await req('POST', `/jobs/${openJob.id}/accept`, { token: freeT })
  ok(accStillLocked.status === 400 && /uniforme/i.test(accStillLocked.data?.message || ''), 'ainda bloqueado até o uniforme ser aprovado', accStillLocked.data?.message)

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
      profile: { companyName: 'Mercado Convidado', cnpj: `${Date.now()}`.slice(0, 14), address: 'Rua Convite, 1' },
    },
  })
  ok(regMarket.status === 201 && regMarket.data.profile.agencyId === agencyId, 'supermercado cadastrado via convite já nasce vinculado à agência', regMarket.data)
  const reuseMarket = await req('POST', '/auth/register', {
    body: {
      name: 'Outro', email: `outro-${Date.now()}@email.com`, password: '123456', inviteToken: inviteMarketToken,
      profile: { companyName: 'X', cnpj: `${Date.now() + 1}`.slice(0, 14), address: 'Rua X' },
    },
  })
  ok(reuseMarket.status === 400, 'convite de supermercado não pode ser reaproveitado', reuseMarket.data)
  const openMarketReg = await req('POST', '/auth/register', {
    body: { name: 'Sem convite', email: `semconvite-${Date.now()}@email.com`, password: '123456', role: 'supermarket',
      profile: { companyName: 'X', cnpj: `${Date.now() + 2}`.slice(0, 14), address: 'Rua Y' } },
  })
  ok(openMarketReg.status === 400, 'autocadastro aberto de supermercado (sem convite) é recusado', openMarketReg.data)

  const inviteFreeRes = await req('POST', '/agency/invites', { token: agencyT, body: { role: 'freelancer' } })
  const regFree = await req('POST', '/auth/register', {
    body: {
      name: 'Colaborador Convidado', email: `colab-convite-${Date.now()}@email.com`, password: '123456',
      inviteToken: inviteFreeRes.data.token, profile: { document: '00011122233' },
    },
  })
  ok(
    regFree.status === 201 && regFree.data.profile.registrationStatus === 'approved' && regFree.data.profile.agencyId === agencyId,
    'colaborador cadastrado via convite já nasce aprovado e vinculado à agência',
    regFree.data
  )
  const inviteLeaderRes = await req('POST', '/agency/invites', { token: agencyT, body: { role: 'leader' } })
  ok(inviteLeaderRes.status === 400, 'convite de líder ainda é recusado (feature futura)', inviteLeaderRes.data)

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
      profile: { companyName: 'Agência Rival', cnpj: `${Date.now() + 3}`.slice(0, 14), address: 'Rua Rival, 1' },
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
      profile: { agencyId: otherAgencyId, document: '99988877766' },
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

  console.log(`\n----------\n${pass} passaram, ${fail} falharam`)
  await db.end()
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error('\nERRO FATAL:', e)
  try { await db.end() } catch {}
  process.exit(1)
})
