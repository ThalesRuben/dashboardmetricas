// Supabase Edge Function — whatsapp-send
//
// Dispara mensagens em massa via Z-API (WhatsApp Web).
// Z-API não tem o conceito de "template HSM" — manda texto livre.
// A mensagem pode conter {{1}}, {{2}}, ... que são substituídos por
// recipient.params (ou variables como fallback global).
//
// Salva o resultado consolidado em `whatsapp_disparos`.
//
// Variáveis de ambiente:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   ZAPI_INSTANCE_ID
//   ZAPI_TOKEN
//   ZAPI_CLIENT_TOKEN
//   INTERNAL_API_KEY      opcional
//
// Body esperado:
//   {
//     "tenant_id": "uuid",                  // opcional
//     "rotulo": "promocao-junho",           // identifica o disparo no histórico
//     "mensagem": "Oi {{1}}, hoje temos...",// texto com placeholders {{n}}
//     "variables": ["Marina"],              // valores padrão (usados se recipient não trouxer params)
//     "recipients": [
//       { "phone": "5511984321100", "params": ["Marina"] },
//       { "phone": "5511990214488" }
//     ],
//     "dry_run": false
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ZAPI_INSTANCE     = Deno.env.get('ZAPI_INSTANCE_ID')
const ZAPI_TOKEN        = Deno.env.get('ZAPI_TOKEN')
const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN')
const INTERNAL_KEY      = Deno.env.get('INTERNAL_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Recipient { phone: string; params?: string[] }
interface SendBody {
  tenant_id?: string
  rotulo: string
  mensagem: string
  variables?: string[]
  recipients: Recipient[]
  dry_run?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (INTERNAL_KEY && req.headers.get('x-internal-key') !== INTERNAL_KEY) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: SendBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  if (!body.mensagem) return json({ error: 'mensagem é obrigatória' }, 400)
  if (!body.rotulo)   return json({ error: 'rotulo é obrigatório' }, 400)
  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    return json({ error: 'recipients vazio' }, 400)
  }

  const dryRun = !!body.dry_run
  const semConfig = !ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN
  const efetivoDry = dryRun || semConfig

  const resultados: Array<{ phone: string; ok: boolean; id?: string; error?: string }> = []

  for (const r of body.recipients) {
    const params = r.params || body.variables || []
    const texto  = aplicarVars(body.mensagem, params)
    if (efetivoDry) {
      resultados.push({ phone: r.phone, ok: true, id: 'dry-run' })
      continue
    }
    try {
      const id = await zapiSendText(r.phone, texto)
      resultados.push({ phone: r.phone, ok: true, id })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      resultados.push({ phone: r.phone, ok: false, error: msg })
    }
  }

  const enviados = resultados.filter(x => x.ok).length
  const falhas   = resultados.length - enviados

  // Persiste o disparo (mantém o schema atual da tabela: template_name vira rotulo).
  if (!semConfig && body.tenant_id) {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { error } = await supabase.from('whatsapp_disparos').insert({
      tenant_id: body.tenant_id,
      template_name: body.rotulo,
      template_lang: 'pt_BR',
      variables: body.variables || [],
      total: resultados.length,
      enviados,
      falhas,
      status: falhas === 0 ? 'concluido' : (enviados === 0 ? 'erro' : 'concluido'),
      detalhes: { mensagem: body.mensagem, resultados },
    })
    if (error) {
      return json({
        message: 'Disparo realizado, mas falhou ao gravar histórico.',
        warning: error.message,
        enviados, falhas, resultados,
      }, 207)
    }
  }

  return json({
    message: efetivoDry ? 'Dry-run concluído (nada foi enviado).' : 'Disparo concluído.',
    dry_run: efetivoDry,
    sem_config: semConfig,
    total: resultados.length,
    enviados,
    falhas,
    resultados,
  })
})

function aplicarVars(template: string, params: string[]): string {
  return template.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
    const i = Number(idx) - 1
    return params[i] != null ? String(params[i]) : ''
  })
}

async function zapiSendText(phone: string, message: string): Promise<string> {
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CLIENT_TOKEN!,
    },
    body: JSON.stringify({
      phone: phone.replace(/\D/g, ''),
      message,
    }),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok || out.error) {
    throw new Error(`Z-API ${res.status}: ${out.error || out.message || JSON.stringify(out)}`)
  }
  return out.messageId || out.zaapId || out.id || 'sent'
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
