// Runs the real Edge Function handlers with isolated database/provider boundaries.
// No network requests or customer messages are made.
// Run: node --test scripts/verify-whatsapp-routing.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const PHONE_A = '5531990842381'
const PHONE_B = '5531991340420'
const numbers = [
  { tenant_id: 'tenant', display_number: PHONE_A, provider: 'zapi', zapi_instance_id: 'instance-a', ativo: true },
  { tenant_id: 'tenant', display_number: PHONE_B, provider: 'zapi', zapi_instance_id: 'instance-b', ativo: true },
]

async function invoke(name, options = {}) {
  const env = {
    SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'service-test',
    ZAPI_INSTANCE_ID: 'instance-a', ZAPI_TOKEN: 'token-a', ZAPI_CLIENT_TOKEN: 'client-test',
    ZAPI_INSTANCE_TOKENS: JSON.stringify({ 'instance-b': 'token-b' }),
    ...options.env,
  }
  const calls = []
  const writes = []
  const queries = []
  const db = { from(table) {
    const filters = []
    let value
    const builder = {
      select() { return this },
      eq(key, v) { filters.push([key, v]); return this },
      insert(v) { writes.push({ table, value: v }); value = { id: 'msg-test' }; return this },
      update(v) { writes.push({ table, value: v }); value = {}; return this },
      single() { return this },
      then(onResolve, onReject) {
        queries.push({ table, filters })
        if (value === undefined) {
          if (table === 'whatsapp_threads') value = {
            id: 'thread-test', tenant_id: 'tenant', contato_id: 'contact-test',
            inbox_phone: PHONE_B, ...options.thread,
          }
          else if (table === 'whatsapp_contatos') value = { phone: '5531987654321' }
          else if (table === 'whatsapp_numbers') value = (options.numbers ?? numbers)
            .filter(row => filters.every(([key, v]) => row[key] === v))
          else throw new Error(`Unexpected table: ${table}`)
        }
        return Promise.resolve({ data: value, error: null }).then(onResolve, onReject)
      },
    }
    return builder
  } }
  let handler
  const context = vm.createContext({
    Response, Request, URL, console, AbortSignal,
    Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn } },
    fetch: async (url, init = {}) => {
      calls.push({ url, ...init })
      if (url.endsWith('/device')) {
        const phone = options.devicePhone ?? (url.includes('/instance-b/') ? PHONE_B : PHONE_A)
        return Response.json({ phone }, { status: options.deviceStatus ?? 200 })
      }
      if (url.endsWith('/send-text')) return Response.json(
        options.sendError ? { error: 'provider-unavailable' } : { messageId: 'external-test' },
        { status: options.sendError ? 500 : 200 },
      )
      throw new Error('Unexpected provider endpoint')
    },
  })
  function load(filename) {
    const source = readFileSync(filename, 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    })
    const module = { exports: {} }
    const localRequire = specifier => {
      if (specifier.startsWith('https://esm.sh/@supabase/supabase-js@')) return { createClient: () => db }
      if (specifier.startsWith('.')) return load(resolve(dirname(filename), specifier))
      throw new Error(`Unexpected import: ${specifier}`)
    }
    const fn = vm.runInContext(`(function(require,module,exports){${outputText}\n})`, context, { filename })
    fn(localRequire, module, module.exports)
    return module.exports
  }
  load(resolve(`supabase/functions/${name}/index.ts`))
  const body = options.body ?? { thread_id: 'thread-test', texto: 'Oi, podemos agendar?' }
  const response = await handler(new Request('https://example.invalid', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  }))
  return { status: response.status, body: await response.json(), calls, writes, queries }
}

test('reply uses the attending line B and its own token instead of global line A', async () => {
  const result = await invoke('inbox-reply')
  assert.equal(result.status, 200)
  const sends = result.calls.filter(call => call.url.endsWith('/send-text'))
  assert.equal(sends.length, 1)
  assert.match(sends[0].url, /\/instances\/instance-b\/token\/token-b\/send-text$/)
  assert.equal(JSON.parse(sends[0].body).phone, '5531987654321')
  assert.ok(result.queries.find(q => q.table === 'whatsapp_numbers')?.filters
    .some(([key, value]) => key === 'tenant_id' && value === 'tenant'))
})

for (const [label, options] of [
  ['missing attending line', { thread: { inbox_phone: null } }],
  ['inactive line', { numbers: numbers.map(n => ({ ...n, ativo: false })) }],
  ['unsupported provider', { numbers: numbers.map(n => ({ ...n, provider: 'meta_official' })) }],
  ['missing token for line B', { env: { ZAPI_INSTANCE_TOKENS: undefined } }],
  ['wrong connected phone', { devicePhone: PHONE_A }],
  ['unavailable device check', { deviceStatus: 503 }],
  ['missing credentials', { env: { ZAPI_TOKEN: undefined, ZAPI_INSTANCE_TOKENS: undefined } }],
  ['invalid per-line token configuration', { env: { ZAPI_INSTANCE_TOKENS: '{invalid-json' } }],
  ['ambiguous number registration', { numbers: [...numbers, { ...numbers[1], display_number: '(31) 99134-0420' }] }],
  ['unregistered line connected to the wrong global instance', { numbers: [] }],
]) {
  test(`reply blocks ${label} without sending or marking a message sent`, async () => {
    const result = await invoke('inbox-reply', options)
    assert.ok(result.status >= 400, `Expected rejection, got ${result.status}`)
    assert.equal(result.calls.filter(c => c.url.endsWith('/send-text')).length, 0)
    assert.equal(result.writes.length, 0)
  })
}

test('legacy global credentials remain usable when connected phone matches line A', async () => {
  const result = await invoke('inbox-reply', { thread: { inbox_phone: PHONE_A }, numbers: [] })
  assert.equal(result.status, 200)
  assert.ok(result.calls.some(c => c.url.endsWith('/device')))
  assert.match(result.calls.find(c => c.url.endsWith('/send-text')).url, /\/instance-a\/token\/token-a\//)
})

test('formatted phone numbers resolve to the same attending line', async () => {
  const result = await invoke('inbox-reply', {
    thread: { inbox_phone: '+55 (31) 99134-0420' }, devicePhone: '553191340420',
  })
  assert.equal(result.status, 200)
  assert.match(result.calls.find(c => c.url.endsWith('/send-text')).url, /\/instance-b\//)
})

test('sender tokens never enter response bodies or persisted message metadata', async () => {
  const result = await invoke('inbox-reply')
  assert.equal(result.status, 200)
  const serialized = JSON.stringify({ body: result.body, writes: result.writes })
  assert.doesNotMatch(serialized, /token-a|token-b|client-test/)
  assert.equal(result.writes.find(w => w.table === 'whatsapp_msgs').value.metadata.inbox_phone, PHONE_B)
})

test('sender validation checks the real line without sending or writing messages', async () => {
  const result = await invoke('inbox-reply', { body: { thread_id: 'thread-test', validate_only: true } })
  assert.equal(result.status, 200)
  assert.equal(result.body.validation_only, true)
  assert.equal(result.body.inbox_phone, PHONE_B)
  assert.equal(result.calls.filter(c => c.url.endsWith('/device')).length, 1)
  assert.equal(result.calls.filter(c => c.url.endsWith('/send-text')).length, 0)
  assert.equal(result.writes.length, 0)
})

test('sender validation blocks a mismatched connected phone without sending', async () => {
  const result = await invoke('inbox-reply', {
    body: { thread_id: 'thread-test', validate_only: true }, devicePhone: PHONE_A,
  })
  assert.equal(result.status, 409)
  assert.equal(result.calls.filter(c => c.url.endsWith('/send-text')).length, 0)
  assert.equal(result.writes.length, 0)
})

test('provider failure is recorded as an error rather than a sent message', async () => {
  const result = await invoke('inbox-reply', { sendError: true })
  assert.equal(result.status, 502)
  assert.equal(result.writes.find(w => w.table === 'whatsapp_msgs').value.status, 'erro')
  assert.equal(result.writes.filter(w => w.table === 'whatsapp_threads').length, 0)
})

const bulkBody = {
  tenant_id: 'tenant', inbox_phone: PHONE_B, rotulo: 'campanha', mensagem: 'Oi {{1}}!',
  recipients: [{ phone: '5531987654321', params: ['Marina'] }],
}

test('bulk send uses the explicitly selected line B', async () => {
  const result = await invoke('whatsapp-send', { body: bulkBody })
  assert.equal(result.status, 200)
  const send = result.calls.find(c => c.url.endsWith('/send-text'))
  assert.match(send.url, /\/instance-b\/token\/token-b\//)
  assert.equal(JSON.parse(send.body).message, 'Oi Marina!')
  assert.equal(result.writes.find(w => w.table === 'whatsapp_disparos').value.detalhes.inbox_phone, PHONE_B)
})

for (const [label, options] of [
  ['missing sender', { body: { ...bulkBody, inbox_phone: null } }],
  ['missing tenant', { body: { ...bulkBody, tenant_id: undefined } }],
  ['wrong connected phone', { body: bulkBody, devicePhone: PHONE_A }],
]) {
  test(`bulk send blocks ${label} before any sends`, async () => {
    const result = await invoke('whatsapp-send', options)
    assert.ok(result.status >= 400)
    assert.equal(result.calls.filter(c => c.url.endsWith('/send-text')).length, 0)
    assert.equal(result.writes.length, 0)
  })
}

test('explicit bulk dry run makes no provider calls and writes no sent history', async () => {
  const result = await invoke('whatsapp-send', { body: { ...bulkBody, dry_run: true } })
  assert.equal(result.status, 200)
  assert.equal(result.body.dry_run, true)
  assert.equal(result.calls.length, 0)
  assert.equal(result.writes.length, 0)
})
