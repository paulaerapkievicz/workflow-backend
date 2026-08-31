/**
 * Teste de fluxo ponta a ponta (Bloco B): pedidos/carrinho, valor/hora da agência,
 * check-in/out por turno com geolocalização, liquidação por horas, fechamento mensal
 * e faturamento. Requer o servidor rodando em BASE_URL e o banco de teste seedado.
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
function ok(cond, label, extra) {
  if (cond) { pass++; console.log(`  ✔ ${label}`) }
  else { fail++; console.error(`  ✘ ${label}${extra ? ` — ${JSON.stringify(extra)}` : ''}`) }
}
function section(t) { console.log(`\n▶ ${t}`) }

async function req(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { /* sem corpo */ }
  return { status: res.status, data }
}

const login = async (email) => {
  const { status, data } = await req('POST', '/auth/login', { body: { email, password: '123456' } })
  if (status !== 200) throw new Error(`login ${email} falhou: ${status} ${JSON.stringify(data)}`)
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

async function main() {
  await db.connect()

  section('Login dos papéis')
  const superT = await login('supermarket@email.com')
  const agencyT = await login('agency@email.com')
  const freeT = await login('free1@email.com')
  ok(!!superT && !!agencyT && !!freeT, 'tokens obtidos')

  const meFree = (await req('GET', '/auth/me', { token: freeT })).data
  const meSuper = (await req('GET', '/auth/me', { token: superT })).data
  const meAgency = (await req('GET', '/auth/me', { token: agencyT })).data
  const freelancerId = meFree.profile.id
  const supermarketId = meSuper.profile.id
  const agencyId = meAgency.profile.id

  section('Agência: tabela de valor/hora')
  let rates = (await req('GET', '/agency/rates', { token: agencyT })).data
  ok(Array.isArray(rates) && rates.length >= 5, 'agência já tem valores/hora seedados', rates?.length)
  const cats = (await req('GET', '/categories', { token: superT })).data
  const catCaixa = cats.find((c) => c.name === 'Operador de Caixa')
  const catRepositor = cats.find((c) => c.name === 'Repositor')
  const catPadeiro = cats.find((c) => c.name === 'Padeiro')
  const rateCaixa = rates.find((r) => r.categoryId === catCaixa.id)
  ok(Number(rateCaixa.hourlyRate) === 24, 'valor/hora Operador de Caixa = 24', rateCaixa?.hourlyRate)

  // remove o valor de Padeiro para testar o bloqueio de aceite
  const ratePadeiro = rates.find((r) => r.categoryId === catPadeiro.id)
  await req('DELETE', `/agency/rates/${ratePadeiro.id}`, { token: agencyT })

  section('Supermercado: cria um pedido (carrinho) — 1 clique, várias vagas')
  const day = new Date(Date.now() + 24 * 3600 * 1000)
  const iso = (h, m) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString()
  const branches = (await req('GET', '/branches', { token: superT })).data
  const branchCentro = branches.find((b) => b.name === 'Filial Centro')

  const orderRes = await req('POST', '/orders', {
    token: superT,
    body: {
      branchId: branchCentro.id,
      notes: 'Reforço de fim de semana',
      items: [
        { categoryId: catCaixa.id, title: 'Operador de Caixa', quantity: 3, photosRequired: true,
          shifts: [{ startTime: iso(8, 0), endTime: iso(14, 0) }] },
        { categoryId: catRepositor.id, title: 'Repositor', quantity: 2, photosRequired: false,
          shifts: [{ startTime: iso(8, 0), endTime: iso(12, 0), label: 'Manhã' },
                   { startTime: iso(13, 0), endTime: iso(17, 0), label: 'Tarde' }] },
        { categoryId: catPadeiro.id, title: 'Padeiro', quantity: 1, photosRequired: false,
          shifts: [{ startTime: iso(6, 0), endTime: iso(10, 0) }] },
      ],
    },
  })
  ok(orderRes.status === 201, 'POST /orders 201', orderRes.status === 201 ? undefined : orderRes.data)
  const order = orderRes.data
  ok(order.items.length === 3, 'pedido com 3 itens', order.items?.length)
  ok(order.orderJobs.length === 6, 'pedido gerou 6 vagas (3+2+1)', order.orderJobs?.length)
  const caixaJobs = order.orderJobs.filter((j) => j.categoryId === catCaixa.id)
  ok(caixaJobs.length === 3, '3 vagas de Operador de Caixa', caixaJobs.length)
  ok(caixaJobs.every((j) => j.paymentAmount == null), 'vagas sem valor definido pelo supermercado')
  const repJob = order.orderJobs.find((j) => j.categoryId === catRepositor.id)
  ok((repJob.shifts?.length ?? 0) === 2, 'vaga de Repositor tem 2 turnos', repJob.shifts?.length)
  ok(repJob.contractedMinutes === 480, 'Repositor: 480 min contratados (2x4h)', repJob.contractedMinutes)
  const padeiroJob = order.orderJobs.find((j) => j.categoryId === catPadeiro.id)

  section('Freelancer: vagas disponíveis respeitam a tabela de valor/hora')
  const avail = (await req('GET', '/jobs/available', { token: freeT })).data
  ok(avail.some((j) => j.categoryId === catCaixa.id), 'Operador de Caixa aparece (tem valor/hora)')
  ok(!avail.some((j) => j.categoryId === catPadeiro.id), 'Padeiro NÃO aparece (sem valor/hora)')

  const accPadeiro = await req('POST', `/jobs/${padeiroJob.id}/accept`, { token: freeT })
  ok(accPadeiro.status === 400, 'aceitar vaga sem valor/hora é bloqueado', accPadeiro.data?.message)
  // repõe o valor de Padeiro
  await req('POST', '/agency/rates', { token: agencyT, body: { categoryId: catPadeiro.id, hourlyRate: 25 } })

  section('Freelancer aceita e faz check-in/out com geolocalização')
  const job = caixaJobs[0]
  const acc = await req('POST', `/jobs/${job.id}/accept`, { token: freeT })
  ok(acc.status === 200 && acc.data.status === 'accepted', 'vaga aceita', acc.data?.status)

  const noGeo = await req('POST', `/jobs/${job.id}/logs/checkin`, { token: freeT, body: {} })
  ok(noGeo.status === 400, 'check-in sem localização é recusado', noGeo.data?.message)

  const farGeo = await req('POST', `/jobs/${job.id}/logs/checkin`, { token: freeT, body: FAR })
  ok(farGeo.status === 400 && /limite de/.test(farGeo.data?.message || ''), 'check-in fora do raio é recusado', farGeo.data?.message)

  const ci = await req('POST', `/jobs/${job.id}/logs/checkin`, { token: freeT, body: { ...CENTRO, accuracy: 12 } })
  ok(ci.status === 201, 'check-in no local é aceito', ci.data?.message)
  const jobAfterCi = (await req('GET', `/jobs/${job.id}`, { token: freeT })).data
  ok(jobAfterCi.status === 'in_progress', 'vaga em andamento após check-in', jobAfterCi.status)
  ok(jobAfterCi.shifts[0].status === 'in_progress', 'turno 1 em andamento')

  section('Agência: acompanhamento em tempo real')
  const live = (await req('GET', '/jobs/live', { token: agencyT })).data
  ok(Array.isArray(live) && live.some((j) => j.id === job.id), 'vaga aparece em /jobs/live', live?.length)

  section('Check-out: exige foto e recalcula por horas trabalhadas')
  const coNoPhoto = await req('POST', `/jobs/${job.id}/logs/checkout`, { token: freeT, body: CENTRO })
  ok(coNoPhoto.status === 400, 'check-out sem foto é recusado', coNoPhoto.data?.message)

  // envia foto de comprovação (multipart)
  const fd = new FormData()
  fd.append('photo', new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' }), 'comprovacao.jpg')
  fd.append('caption', 'Caixa 03 aberto')
  const upRes = await fetch(`${BASE}/jobs/${job.id}/photos`, {
    method: 'POST', headers: { Authorization: `Bearer ${freeT}` }, body: fd,
  })
  ok(upRes.status === 201, 'upload de foto 201', upRes.status)

  // "trabalha" 6h: recua o check-in do turno 6 horas no banco
  await db.query(
    `UPDATE job_shifts SET check_in_at = check_in_at - interval '6 hours' WHERE job_id = $1 AND status = 'in_progress'`,
    [job.id]
  )
  await db.query(
    `UPDATE job_logs SET timestamp = timestamp - interval '6 hours' WHERE job_id = $1 AND event_type = 'check-in'`,
    [job.id]
  )

  const freeBefore = Number((await req('GET', `/freelancers/${freelancerId}`, { token: freeT })).data.availableBalance)
  const agencyBefore = Number((await req('GET', `/agencies/${agencyId}`, { token: agencyT })).data.availableBalance)

  const co = await req('POST', `/jobs/${job.id}/logs/checkout`, { token: freeT, body: CENTRO })
  ok(co.status === 201, 'check-out aceito', co.data?.message)
  ok(co.data.jobCompleted === true, 'vaga concluída (turno único fechado)')

  const jobDone = (await req('GET', `/jobs/${job.id}`, { token: freeT })).data
  ok(jobDone.status === 'completed', 'status = completed', jobDone.status)
  ok(jobDone.workedMinutes >= 355 && jobDone.workedMinutes <= 361, 'minutos trabalhados ≈ 360', jobDone.workedMinutes)
  // 24/h * 6h = 144 ; agência 15% = 21,6 ; freelancer = 122,4
  ok(Math.abs(Number(jobDone.grossAmount) - 144) < 0.5, 'valor bruto ≈ R$ 144 (24/h × 6h)', jobDone.grossAmount)

  section('Carteiras creditadas na conclusão')
  const pays = (await req('GET', '/payments/mine', { token: freeT })).data
  const p = pays.find((x) => x.jobId === job.id)
  ok(!!p, 'pagamento criado para a vaga')
  ok(p.grossAmount === undefined, 'freelancer não enxerga valor bruto (carteira opaca)')
  ok(Math.abs(Number(p.freelancerAmount) - 122.4) < 0.5, 'freelancerAmount ≈ 122,40', p?.freelancerAmount)

  const freeAfter = Number((await req('GET', `/freelancers/${freelancerId}`, { token: freeT })).data.availableBalance)
  const agencyAfter = Number((await req('GET', `/agencies/${agencyId}`, { token: agencyT })).data.availableBalance)
  ok(Math.abs((freeAfter - freeBefore) - 122.4) < 0.5, 'carteira do freelancer +122,40', freeAfter - freeBefore)
  ok(Math.abs((agencyAfter - agencyBefore) - 21.6) < 0.5, 'carteira da agência +21,60', agencyAfter - agencyBefore)

  section('Multi-turno: check-in/out por turno (vaga de Repositor)')
  await req('POST', `/jobs/${repJob.id}/accept`, { token: freeT })
  const r1 = await req('POST', `/jobs/${repJob.id}/logs/checkin`, { token: freeT, body: CENTRO })
  ok(r1.status === 201, 'turno 1: check-in')
  const rDouble = await req('POST', `/jobs/${repJob.id}/logs/checkin`, { token: freeT, body: CENTRO })
  ok(rDouble.status === 400, 'não deixa fazer check-in do turno 2 sem fechar o 1')
  const r1o = await req('POST', `/jobs/${repJob.id}/logs/checkout`, { token: freeT, body: CENTRO })
  ok(r1o.status === 201 && r1o.data.jobCompleted === false, 'turno 1: check-out (vaga ainda não concluída)')
  const r2 = await req('POST', `/jobs/${repJob.id}/logs/checkin`, { token: freeT, body: CENTRO })
  ok(r2.status === 201, 'turno 2: check-in')
  const r2o = await req('POST', `/jobs/${repJob.id}/logs/checkout`, { token: freeT, body: CENTRO })
  ok(r2o.status === 201 && r2o.data.jobCompleted === true, 'turno 2: check-out conclui a vaga')
  const r3 = await req('POST', `/jobs/${repJob.id}/logs/checkin`, { token: freeT, body: CENTRO })
  ok(r3.status === 400, 'não há 3º turno para check-in')

  section('Fechamento mensal: agência fecha o mês do supermercado')
  const ref = yyyymm()
  // garante datas de conclusão dentro do mês corrente
  await db.query(`UPDATE jobs SET completed_at = NOW() WHERE status = 'completed' AND supermarket_id = $1 AND monthly_invoice_id IS NULL`, [supermarketId])

  const preview = (await req('GET', `/closings/preview?supermarketId=${supermarketId}&referenceMonth=${ref}`, { token: agencyT })).data
  ok(preview.totals.totalJobs >= 2, 'prévia do fechamento lista vagas concluídas', preview.totals?.totalJobs)

  const closeRes = await req('POST', '/closings', { token: agencyT, body: { supermarketId, referenceMonth: ref } })
  ok(closeRes.status === 201, 'POST /closings 201', closeRes.status === 201 ? undefined : closeRes.data)
  const closing = closeRes.data
  ok(closing.type === 'monthly' && closing.status === 'pending', 'fatura mensal pendente criada')
  ok(closing.totalJobs >= 2, 'fatura mensal agrega as vagas', closing.totalJobs)
  ok(Number(closing.totalAmount) > 0, 'fatura mensal tem valor', closing.totalAmount)

  const closeAgain = await req('POST', '/closings', { token: agencyT, body: { supermarketId, referenceMonth: ref } })
  ok(closeAgain.status === 400, 'não fecha duas vezes o mesmo período sem novas vagas', closeAgain.data?.message)

  section('Supermercado: faturamento (histórico por mês e função)')
  const billing = (await req('GET', '/billing/summary', { token: superT })).data
  ok(billing.months.length >= 1, 'faturamento tem ao menos 1 mês')
  const thisMonth = billing.months.find((m) => m.referenceMonth === ref)
  ok(!!thisMonth, 'mês corrente presente no faturamento')
  ok(thisMonth.totalJobs >= 2, 'total de vagas do mês', thisMonth?.totalJobs)
  ok(thisMonth.workedHours > 0 && thisMonth.contractedHours > 0, 'horas contratadas e trabalhadas exibidas', {
    contratadas: thisMonth?.contractedHours, trabalhadas: thisMonth?.workedHours,
  })
  ok(thisMonth.byCategory.some((c) => c.categoryName === 'Operador de Caixa'), 'quebra por função inclui Operador de Caixa')
  ok(thisMonth.invoices.some((i) => i.id === closing.id), 'fatura mensal aparece no faturamento')

  section('Supermercado paga a fatura mensal')
  const payInv = await req('POST', `/invoices/${closing.id}/pay`, { token: superT })
  ok(payInv.status === 200 && payInv.data.status === 'paid', 'fatura mensal paga', payInv.data?.status)

  section('Freelancer: relatório de trabalhos')
  const report = (await req('GET', '/reports/freelancer', { token: freeT })).data
  ok(report.items.length >= 2, 'relatório lista trabalhos concluídos', report.items?.length)
  ok(report.totals.earned > 0, 'total recebido no relatório', report.totals?.earned)
  ok(report.items.every((i) => i.workedHours >= 0 && 'amount' in i), 'itens do relatório têm horas e valor')

  section('Pedido reflete o andamento das vagas')
  const orderNow = (await req('GET', `/orders/${order.id}`, { token: superT })).data
  ok(orderNow.status === 'in_progress', 'pedido em andamento (algumas vagas concluídas, outras abertas)', orderNow.status)

  console.log(`\n──────────\n${pass} passaram, ${fail} falharam`)
  await db.end()
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error('\nERRO FATAL:', e)
  try { await db.end() } catch {}
  process.exit(1)
})
