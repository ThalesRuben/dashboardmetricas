// Real PostgreSQL regression checks, isolated in memory. No customer data or network.
// Setup: npm install --prefix .vercel/whatsapp-metrics-tests --no-save --package-lock=false @electric-sql/pglite@0.5.16
// Run: node --test scripts/verify-whatsapp-metrics.mjs
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(resolve('.vercel/whatsapp-metrics-tests/package.json'))
const { PGlite } = require('@electric-sql/pglite')
const db = new PGlite()
const baseline = process.env.WHATSAPP_METRICS_BASELINE === '1'
const reportFunction = baseline ? 'get_whatsapp_summary' : 'get_whatsapp_message_summary'
const A = '5531990842381', B = '5531991340420'
const tenant = '00000000-0000-0000-0000-000000000001'
const otherTenant = '00000000-0000-0000-0000-000000000002'
const from = '2020-06-01T03:00:00Z', to = '2020-07-01T02:59:59.999Z'
let sequence = 100
const id = () => `00000000-0000-0000-0000-${String(++sequence).padStart(12, '0')}`
async function thread(phone, inbox, options = {}) {
  const contactId = options.contactId || id(), threadId = id()
  if (!options.contactId) await db.query('insert into whatsapp_contatos values ($1,$2,$3,null)', [contactId, options.tenant || tenant, phone])
  await db.query('insert into whatsapp_threads values ($1,$2,$3,$4,$5,$6,$7)', [
    threadId, options.tenant || tenant, contactId, inbox, options.status || 'aberta',
    options.created || '2020-05-01T12:00:00Z', 'whatsapp',
  ])
  return threadId
}
async function msg(threadId, autor, hora, texto, options = {}) {
  await db.query('insert into whatsapp_msgs values ($1,$2,$3,$4,$5,$6,$7,$8)', [
    id(), options.tenant || tenant, threadId, autor, texto, hora, options.status || 'enviada', options.metadata || {},
  ])
}
async function report(inbox = A, dateFrom = from, dateTo = to) {
  const result = await db.query(`select public.${reportFunction}($1,$2::timestamptz,$3::timestamptz) as data`, [inbox, dateFrom, dateTo])
  return result.rows[0].data
}

before(async () => {
  await db.exec(`
    create role authenticated; create role anon; create role service_role;
    create function public.current_user_tenants() returns setof uuid language sql stable as
      $$ select nullif(current_setting('app.test_tenant',true),'')::uuid $$;
    create table whatsapp_contatos(id uuid primary key, tenant_id uuid, phone text, lid text);
    create table whatsapp_threads(id uuid primary key, tenant_id uuid, contato_id uuid, inbox_phone text, status text, criado_em timestamptz, origem text);
    create table whatsapp_msgs(id uuid primary key, tenant_id uuid, thread_id uuid, autor text, texto text, hora timestamptz, status text, metadata jsonb);
    create table crm_vendas(id uuid primary key, tenant_id uuid, thread_id uuid, data date, valor_cents bigint);
    create view whatsapp_threads_br as select * from whatsapp_threads;
    create function pct_delta(cur int, prev int) returns numeric language sql immutable as
      $$ select case when prev=0 then 0 else round((cur-prev)*100.0/prev,1) end $$;
  `)
  for (const [file, functionName] of [
    ['0051_whatsapp_ingest_rpc.sql', 'pg_normalizar_phone_br'],
    ['0045_whatsapp_leads_e_higiene.sql', 'detectar_lead_texto'],
  ]) {
    const source = readFileSync('supabase/migrations/' + file, 'utf8')
    const start = source.indexOf(`create or replace function public.${functionName}(`)
    await db.exec(source.slice(start, source.indexOf('$$;', start) + 3))
  }
  const migration = baseline ? '0055_whatsapp_summary_receita.sql'
    : readdirSync('supabase/migrations').find(f => f.endsWith('_whatsapp_message_metrics.sql'))
  await db.exec(readFileSync('supabase/migrations/' + migration, 'utf8'))
  await db.query("select set_config('app.test_tenant',$1,false)", [tenant])

  // One customer, split across old/new threads and phone formats. Three incoming
  // messages are one turn; a reply arrives 10 minutes after its first message.
  const customer = '5531987654321'
  const first = await thread(customer, A)
  await msg(first, 'cliente', '2020-06-15T12:00:00Z', 'Quero saber o valor')
  await msg(first, 'cliente', '2020-06-15T12:02:00Z', 'Meu cabelo e longo')
  const duplicate = await thread('553187654321', A, { created: '2020-06-10T12:00:00Z' })
  await msg(duplicate, 'cliente', '2020-06-15T12:03:00Z', 'Obrigada')
  await msg(first, 'atendente', '2020-06-15T12:10:00Z', 'Bom dia!')
  await msg(first, 'atendente', '2020-06-15T12:11:00Z', 'Seu horario esta agendado para sabado as 10h.')

  // Staff contacted this customer first. Failed, simulated and future messages
  // cannot turn their unanswered incoming message into a completed response.
  const waiting = await thread('5531987654322', A, { created: '2020-06-01T10:00:00Z', status: 'agendado' })
  await msg(waiting, 'atendente', '2020-06-15T12:50:00Z', 'Voce ja tem horario agendado?')
  await msg(waiting, 'cliente', '2020-06-15T13:00:00Z', 'Oi')
  await msg(waiting, 'atendente', '2020-06-15T13:02:00Z', 'Seu horario esta confirmado.', { status: 'erro' })
  await msg(waiting, 'atendente', '2020-06-15T13:03:00Z', 'Seu horario esta confirmado.', { metadata: { simulacao: true } })
  await msg(waiting, 'atendente', '2020-07-01T03:00:00Z', 'Resposta fora do periodo')

  const outbound = await thread('5531987654323', A, { created: '2020-06-02T10:00:00Z', status: 'agendado' })
  await msg(outbound, 'atendente', '2020-06-16T10:00:00Z', 'Agendamento confirmado!')
  const anotherOutbound = await thread('5531987654399', A, { created: '2020-06-03T10:00:00Z' })
  await msg(anotherOutbound, 'atendente', '2020-06-16T10:01:00Z', 'Boa tarde!')

  // Archiving after the fact must not erase a real interaction in the period.
  // A slow reply beyond 24h must not disappear from response time calculations.
  const slow = await thread('5531987654324', A, { status: 'arquivada' })
  await msg(slow, 'cliente', '2020-06-16T15:00:00Z', 'Preciso de um horario')
  await msg(slow, 'atendente', '2020-06-18T15:00:00Z', 'Seu horario esta confirmado para sabado.')
  await msg(slow, 'atendente', '2020-06-18T15:01:00Z', 'Seu horario foi cancelado.')

  // The same customer on another line is a separate conversation.
  const otherLine = await thread(customer, B)
  await msg(otherLine, 'cliente', '2020-06-17T10:00:00Z', 'Ola')
  await msg(otherLine, 'atendente', '2020-06-17T10:00:00Z', 'Ainda nao confirmei seu horario.')

  const foreign = await thread('5531987654325', A, { tenant: otherTenant })
  await msg(foreign, 'cliente', '2020-06-17T10:00:00Z', 'Outro tenant', { tenant: otherTenant })
  const self = await thread(A, A)
  await msg(self, 'cliente', '2020-06-17T10:00:00Z', 'Mensagem da propria linha')
  const boundary = await thread('5531987654326', A)
  await msg(boundary, 'cliente', '2020-06-01T02:59:59Z', 'Fora do inicio no fuso brasileiro')
  const group = await thread('123456789@g.us', A)
  await msg(group, 'cliente', '2020-06-17T10:00:00Z', 'Grupo')

  for (const [threadId, date, cents] of [[first,'2020-06-15',10000], [slow,'2020-06-30',5000], [outbound,'2020-06-20',2000], [first,'2020-07-01',90000]]) {
    await db.query('insert into crm_vendas values ($1,$2,$3,$4,$5)', [id(),tenant,threadId,date,cents])
  }
})
after(async () => { await db.close() })

test('conversas recebidas include older customers and deduplicate phone variants', async () => {
  const data = await report()
  assert.equal(data.resumo.conversas, 3)
  assert.equal(data.resumo.msg_recebidas, 5)
})
test('responses require a valid staff message after the customer within the period', async () => {
  const data = await report()
  const responded = data.resumo.respondidas ?? data.funil.find(f => f.etapa === 'Respondidas')?.valor
  assert.equal(responded, 2)
  assert.equal(data.resumo.sem_resposta, 1)
  assert.equal(data.resumo.taxa_resposta, 66.7)
})
test('each customer turn is counted once and replies slower than 24h remain visible', async () => {
  const { resumo } = await report()
  assert.equal(resumo.tempo_resposta_min, 1445)
  assert.equal(resumo.tempo_resposta_turno_min, 1445)
  assert.equal(resumo.amostra_turnos, 2)
  assert.equal(resumo.pct_sla_resposta, 33.3)
})
test('appointment estimates ignore old status and later cancellations', async () => {
  const { resumo, fontes } = await report()
  assert.equal(resumo.agendamentos, 1)
  assert.equal(resumo.taxa_conversao, 33.3)
  assert.equal(fontes.agendamentos, 'confirmacao_em_mensagens')
})
test('line and tenant isolation keep the same customer separate', async () => {
  const { resumo } = await report(B)
  assert.equal(resumo.conversas, 1)
  assert.equal(resumo.respondidas, 1)
  assert.equal(resumo.agendamentos, 0)
  assert.equal((await report(null)).resumo.conversas, 4)
})
test('an immediate response is a real zero-minute sample', async () => {
  const { resumo } = await report(B)
  assert.equal(resumo.tempo_resposta_min, 0)
  assert.equal(resumo.tempo_resposta_turno_min, 0)
  assert.equal(resumo.amostra_respostas, 1)
  assert.equal(resumo.pct_sla_resposta, 100)
})
test('sales use CRM records and Brazilian calendar dates', async () => {
  const { resumo } = await report()
  assert.equal(resumo.vendas_registradas, 3)
  assert.equal(resumo.receita_total, 170)
})
test('no incoming messages means no response time sample rather than a false zero', async () => {
  const { resumo } = await report('5531999999999')
  assert.equal(resumo.conversas, 0)
  assert.equal(resumo.respondidas, 0)
  assert.equal(resumo.agendamentos, 0)
  assert.equal(resumo.tempo_resposta_min, null)
  assert.equal(resumo.tempo_resposta_turno_min, null)
})
test('daily conversation series reconciles with the same period total', async () => {
  const data = await report()
  assert.equal(data.serie_conversas.reduce((sum, p) => sum + p.value, 0), data.resumo.conversas)
})
test('report uses invoker permissions and does not grant execution to anonymous clients', async () => {
  const result = await db.query("select p.prosecdef, has_function_privilege('anon',p.oid,'execute') as anon_execute from pg_proc p where p.proname=$1", [reportFunction])
  assert.equal(result.rows[0].prosecdef, false)
  assert.equal(result.rows[0].anon_execute, false)
})
test('the report executes under authenticated permissions with tenant filtering', { skip: baseline }, async () => {
  await db.exec('grant select on whatsapp_threads, whatsapp_contatos, whatsapp_msgs, crm_vendas to authenticated; set role authenticated;')
  try {
    assert.equal((await report()).resumo.conversas, 3)
  } finally {
    await db.exec('reset role')
  }
})
test('a report reconciles 1,000 contacts and 20,000 messages without counting message bursts as customers', { skip: baseline }, async t => {
  await db.exec('begin')
  try {
    const benchmarkTenant = '00000000-0000-0000-0000-000000000003'
    await db.query("select set_config('app.test_tenant',$1,true)", [benchmarkTenant])
    await db.exec(`
      insert into whatsapp_contatos
        select md5('bench-contact-'||n)::uuid, '${benchmarkTenant}', '551198'||lpad(n::text,7,'0'), null
        from generate_series(1,1000) n;
      insert into whatsapp_threads
        select md5('bench-thread-'||n)::uuid, '${benchmarkTenant}', md5('bench-contact-'||n)::uuid,
          '${A}', 'aberta', '2020-05-01T10:00:00Z'::timestamptz, 'whatsapp'
        from generate_series(1,1000) n;
      insert into whatsapp_msgs
        select md5('bench-msg-'||n||'-'||i)::uuid, '${benchmarkTenant}', md5('bench-thread-'||n)::uuid,
          case when i%3=0 then 'cliente' else 'atendente' end,
          case when i%3=0 then 'Quero saber o valor' else 'Bom dia, vamos verificar sua duvida.' end,
          '2020-06-15T12:00:00Z'::timestamptz + i*interval '1 minute', 'enviada', '{}'::jsonb
        from generate_series(1,1000) n cross join generate_series(0,19) i;
    `)
    const start = performance.now()
    const data = await report()
    const elapsed = Math.round(performance.now() - start)
    assert.equal(data.resumo.conversas, 1000)
    assert.equal(data.resumo.respondidas, 1000)
    assert.equal(data.resumo.taxa_resposta, 100)
    t.diagnostic(`PostgreSQL isolated report: 1,000 contacts / 20,000 messages in ${elapsed} ms`)
    if (process.env.WHATSAPP_METRICS_EXPLAIN === '1') {
      const migration = readdirSync('supabase/migrations').find(f => f.endsWith('_whatsapp_message_metrics.sql'))
      const source = readFileSync('supabase/migrations/' + migration, 'utf8')
      const body = source.split('create or replace function public.get_whatsapp_message_summary(')[1]
        .split('as $$\n')[1].split('$$;')[0]
        .replace(/\bp_inbox_phone\b/g, '$1::text').replace(/\bp_from\b/g, '$2::timestamptz').replace(/\bp_to\b/g, '$3::timestamptz')
      const explained = await db.query('explain (analyze, format json) ' + body, [A, from, to])
      writeFileSync('.vercel/whatsapp-metrics-query-plan.json', JSON.stringify(explained.rows[0]['QUERY PLAN'], null, 2))
    }
  } finally {
    await db.exec('rollback')
  }
})

for (const [text, expected] of [
  ['Voce ja tem horario agendado?', null], ['Ainda nao confirmei seu horario.', null],
  ['Nao ficou agendado.', null], ['Posso reservar seu horario para sabado?', null],
  ['Temos horarios disponiveis amanha.', null], ['Seu endereco esta confirmado.', null],
  ['Seu horário está agendado para amanhã às 10h.', 'confirmacao'],
  ['Agendamento confirmado! Podemos ajudar com mais alguma coisa?', 'confirmacao'],
  ['Agendei você para sexta às 14h.', 'confirmacao'],
  ['Seu horário foi cancelado.', 'cancelamento'],
]) {
  test(`appointment text: ${text}`, { skip: baseline }, async () => {
    const result = await db.query('select public.classificar_agendamento_whatsapp($1) as event', [text])
    assert.equal(result.rows[0].event, expected)
  })
}
