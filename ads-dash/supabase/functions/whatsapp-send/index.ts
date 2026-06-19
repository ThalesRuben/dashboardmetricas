// Supabase Edge Function — whatsapp-send
//
// Dispara mensagens em massa via WhatsApp Cloud API (Meta) usando template HSM.
// Salva o resultado consolidado em `whatsapp_disparos`.
//
// Variáveis de ambiente (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   WHATSAPP_TOKEN              token permanente do app Meta (System User)
//   WHATSAPP_PHONE_NUMBER_ID    ex: 123456789012345
//   INTERNAL_API_KEY            opcional — se setada, exige header x-internal-key
//
// Deploy:
//   supabase functions deploy whatsapp-send --no-verify-jwt
//
// Body esperado:
//   {
//     "tenant_id": "uuid",                  // opcional, usa default se omitido
//     "template_name": "boas_vindas",
//     "language": "pt_BR",                  // opcional, default pt_BR
//     "variables": ["Marina"],              // opcional — variáveis padrão p/ body
//     "recipients": [
//       { "phone": "5511984321100", "params": ["Marina"] },
//       { "phone": "5511990214488" }        // usa "variables" se params omitido
//     ],
//     "dry_run": false                      // se true, não chama API e não grava
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WA_TOKEN      = Deno.env.get('WHATSAPP_TOKEN')
const WA_PHONE_ID   = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
const INTERNAL_KEY  = Deno.env.get('INTERNAL_API_KEY')

const GRAPH = 'https://graph.facebook.com/v19.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Recipient { phone: string; params?: string[] }
interface SendBody {
  tenant_id?: string
  template_name: string
  language?: string
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

  if (!body.template_name) return json({ error: 'template_name é obrigatório' }, 400)
  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    return json({ error: 'recipients vazio' }, 400)
  }

  const language = body.language || 'pt_BR'
  const dryRun = !!body.dry_run

  // Sem secrets configurados → roda em modo dry-run forçado e retorna
  // resultado simulado pra UI não quebrar enquanto o token não chega.
  const semConfig = !WA_TOKEN || !WA_PHONE_ID
  const efetivoDry = dryRun || semConfig

  const resultados: Array<{ phone: string; ok: boolean; id?: string; error?: string }> = []

  for (const r of body.recipients) {
    const params = r.params || body.variables || []
    if (efetivoDry) {
      resultados.push({ phone: r.phone, ok: true, id: 'dry-run' })
      continue
    }
    try {
      const id = await sendTemplate(r.phone, body.template_name, language, params)
      resultados.push({ phone: r.phone, ok: true, id })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      resultados.push({ phone: r.phone, ok: false, error: msg })
    }
  }

  const enviados = resultados.filter(x => x.ok).length
  const falhas   = resultados.length - enviados

  // Persiste o disparo (mesmo em dry-run real do front; pula se sem config + sem tenant)
  if (!semConfig && body.tenant_id) {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { error } = await supabase.from('whatsapp_disparos').insert({
      tenant_id: body.tenant_id,
      template_name: body.template_name,
      template_lang: language,
      variables: body.variables || [],
      total: resultados.length,
      enviados,
      falhas,
      status: falhas === 0 ? 'concluido' : (enviados === 0 ? 'erro' : 'concluido'),
      detalhes: { resultados },
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

async function sendTemplate(
  to: string,
  name: string,
  language: string,
  params: string[],
): Promise<string> {
  const components = params.length > 0
    ? [{
        type: 'body',
        parameters: params.map(text => ({ type: 'text', text })),
      }]
    : []

  const payload = {
    messaging_product: 'whatsapp',
    to: to.replace(/\D/g, ''),
    type: 'template',
    template: { name, language: { code: language }, components },
  }

  const res = await fetch(`${GRAPH}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const out = await res.json()
  if (!res.ok || out.error) {
    throw new Error(`Graph API ${res.status}: ${out.error?.message || JSON.stringify(out)}`)
  }
  return out.messages?.[0]?.id || 'sent'
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
