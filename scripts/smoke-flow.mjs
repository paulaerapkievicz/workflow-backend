/**
 * Teste de fluxo ponta a ponta (Bloco C). Requer o servidor rodando em BASE_URL
 * e o banco de teste seedado.
 *
 *   NODE_ENV=test PORT=3334 npx ts-node-dev --transpile-only src/server.ts   (noutro terminal)
 *   node scripts/smoke-flow.mjs
 */
import pg from 'pg'
import 'dotenv/config'

const BASE = process.env.BASE_URL || 'http://localhost:3334'
const CENTRO = { latitude: -23.55052, longitude: -46.633308 } // = Filial Centro no seed
const FAR = { latitude: -23.4, longitude: -46.4 }

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

  section('Valores/hora do supermercado + remove Padeiro para testar bloqueio')
  const cats = (await req('GET', '/categories', { token: superT })).data
  const catCaixa = cats.find((c) => c.name === 'Operador de Caixa')
  const catRepositor = cats.find((c) => c.name === 'Repositor')
  const catPadeiro = cats.find((c) => c.name === 'Padeiro')
  const rates = (await req('GET', `/supermarkets/${supermarketId}/rates`, { token: agencyT })).data
  const rateCaixa = rates.find((r) => r.categoryId === catCaixa.id && !r.branchId)
  ok(Number(rateCaixa.hourlyRate) === 32, 'valor/hora Operador de Caixa (padrão) = 32', rateCaixa?.hourlyRate)
  const ratePadeiro = rates.find((r) => r.categoryId === catPadeiro.id && !r.branchId)
  await req('DELETE', `/supermarkets/${supermarketId}/rates/${ratePadeiro.id}`, { token: agencyT })

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

  section('Fechamento mensal: por matriz e prévia por loja')
  const ref = yyyymm()
  await db.query(`UPDATE jobs SET completed_at = NOW() WHERE status='completed' AND supermarket_id=$1 AND monthly_invoice_id IS NULL`, [supermarketId])
  const prevMatriz = (await req('GET', `/closings/preview?supermarketId=${supermarketId}&referenceMonth=${ref}`, { token: agencyT })).data
  ok(prevMatriz.totals.totalJobs >= 1, 'prévia (matriz) lista vagas', prevMatriz.totals?.totalJobs)
  const prevLojaSul = (await req('GET', `/closings/preview?supermarketId=${supermarketId}&referenceMonth=${ref}&branchId=${branchSul.id}`, { token: agencyT })).data
  ok(prevLojaSul.totals.totalJobs === 0, 'prévia por loja (Zona Sul) vazia — vagas foram na Centro', prevLojaSul.totals?.totalJobs)

  const close = await req('POST', '/closings', { token: agencyT, body: { supermarketId, referenceMonth: ref } })
  ok(close.status === 201 && close.data.type === 'monthly' && close.data.branchId == null, 'fechamento da matriz criado')
  ok(Number(close.data.totalAmount) > 0, 'fatura mensal com valor', close.data?.totalAmount)

  section('Faturamento do supermercado (dados + filtros)')
  const billing = (await req('GET', '/billing/summary', { token: superT })).data
  ok(Array.isArray(billing.jobs) && Array.isArray(billing.branches) && Array.isArray(billing.invoices), 'summary tem jobs/branches/invoices')
  ok(billing.jobs.some((j) => j.categoryName === 'Operador de Caixa' && j.branchName === 'Filial Centro'), 'linha com função + loja')
  ok(billing.invoices.some((i) => i.id === close.data.id && i.branchName == null), 'fatura mensal (matriz) no faturamento')
  ok(billing.totals.workedHours > 0, 'totais com horas trabalhadas', billing.totals?.workedHours)

  const payInv = await req('POST', `/invoices/${close.data.id}/pay`, { token: superT })
  ok(payInv.status === 200 && payInv.data.status === 'paid', 'supermercado paga a fatura mensal')

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

  section('Geocodificação (tolerante a rede)')
  const geo = await req('POST', '/branches/geocode', { token: superT, body: { address: 'Avenida Paulista, 1578, São Paulo' } })
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
