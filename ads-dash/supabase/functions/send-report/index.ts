// Supabase Edge Function — send-report
//
// Modos de uso:
//
//  1) Manual: invocar com { schedule_id: <id> } para forçar envio imediato.
//     supabase.functions.invoke('send-report', { body: { schedule_id: 1 } })
//
//  2) Cron (recomendado): chamar SEM body a cada 15 min via pg_cron.
//     A função varre report_schedules ativos e envia os que estão "no horário".
//
// Variáveis de ambiente esperadas (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY     (necessário pra ler/escrever sem RLS)
//   RESEND_API_KEY                (https://resend.com/api-keys)
//   RESEND_FROM                   ex: 'The Blonde Concept <relatorios@seudominio.com>'
//
// Para deploy:
//   supabase functions deploy send-report --no-verify-jwt
//
// Para agendar:
//   No SQL Editor do Supabase rode o bloco em /supabase/cron-setup.sql

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_KEY      = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM     = Deno.env.get('RESEND_FROM') || 'The Blonde Concept <onboarding@resend.dev>'
const INTERNAL_KEY    = Deno.env.get('INTERNAL_API_KEY')

// WhatsApp Cloud API (Meta) — opcional
const WA_TOKEN        = Deno.env.get('WHATSAPP_TOKEN')
const WA_PHONE_ID     = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')

const TZ = 'America/Sao_Paulo'

interface Schedule {
  id: number
  nome: string
  destinatarios: string[]
  whatsapp: string[]
  canais: string[]
  periodicidade: 'diario' | 'semanal' | 'mensal'
  hora_envio: string
  dia_semana: number | null
  dia_mes: number | null
  formato: 'pdf' | 'csv'
  metricas: string[]
  periodo_dados: 'hoje' | 'semana' | 'mes'
  ativo: boolean
  ultimo_envio: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Auth: só aceita chamadas com a chave interna (cron + UI autenticada)
  if (INTERNAL_KEY && req.headers.get('x-internal-key') !== INTERNAL_KEY) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

  let toSend: Schedule[] = []

  if (body?.schedule_id) {
    const { data, error } = await supabase
      .from('report_schedules')
      .select('*')
      .eq('id', body.schedule_id)
      .single()
    if (error || !data) return json({ error: 'Schedule not found' }, 404)
    toSend = [data as Schedule]
  } else {
    const { data } = await supabase
      .from('report_schedules')
      .select('*')
      .eq('ativo', true)
    toSend = (data || []).filter(isDue) as Schedule[]
  }

  const results = []
  for (const s of toSend) {
    try {
      const canais = s.canais?.length ? s.canais : ['email']
      const metrics = await fetchMetrics(supabase, s.periodo_dados)
      const subject = `${s.nome} — ${todayBR()}`
      const entregues: string[] = []

      if (canais.includes('email') && s.destinatarios?.length) {
        const html = buildHtml(s, metrics)
        await sendViaResend(s.destinatarios, subject, html)
        entregues.push(...s.destinatarios)
      }

      if (canais.includes('whatsapp') && s.whatsapp?.length) {
        const texto = buildWhatsappText(s, metrics)
        for (const numero of s.whatsapp) {
          await sendViaWhatsApp(numero, texto)
          entregues.push(numero)
        }
      }

      await supabase.from('report_sends').insert({
        schedule_id: s.id, status: 'ok', destinatarios: entregues,
      })
      await supabase.from('report_schedules').update({
        ultimo_envio: new Date().toISOString(),
        proximo_envio: nextRun(s).toISOString(),
      }).eq('id', s.id)

      results.push({ id: s.id, ok: true, canais })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await supabase.from('report_sends').insert({
        schedule_id: s.id, status: 'error', erro: msg, destinatarios: s.destinatarios,
      })
      results.push({ id: s.id, ok: false, error: msg })
    }
  }

  return json({
    message: results.length === 0 ? 'Nenhum agendamento no horário.' : `Processados: ${results.length}`,
    results,
  })
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isDue(s: Schedule): boolean {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
  const [h, m] = (s.hora_envio || '08:00').split(':').map(Number)

  if (s.ultimo_envio) {
    const last = new Date(s.ultimo_envio)
    const minSinceLast = (now.getTime() - last.getTime()) / 60000
    if (minSinceLast < 60) return false
  }

  const minDiff = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m)
  if (minDiff < 0 || minDiff > 30) return false

  if (s.periodicidade === 'semanal' && s.dia_semana !== null && now.getDay() !== s.dia_semana) return false
  if (s.periodicidade === 'mensal'  && s.dia_mes !== null && now.getDate() !== s.dia_mes) return false

  return true
}

function nextRun(s: Schedule): Date {
  const now = new Date()
  const next = new Date(now)
  if (s.periodicidade === 'diario')   next.setDate(now.getDate() + 1)
  if (s.periodicidade === 'semanal')  next.setDate(now.getDate() + 7)
  if (s.periodicidade === 'mensal')   next.setMonth(now.getMonth() + 1)
  return next
}

function todayBR() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: TZ })
}

async function fetchMetrics(supabase: ReturnType<typeof createClient>, period: string) {
  const { data } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('period', period)
    .order('created_at', { ascending: false })
    .limit(1)
  return data?.[0]?.payload || null
}

function buildHtml(s: Schedule, d: any): string {
  if (!d) {
    return `<p>Sem dados para o período <strong>${s.periodo_dados}</strong>. Verifique a tabela <code>daily_metrics</code>.</p>`
  }
  const k = (l: string, v: string) => `<div style="display:inline-block;background:#fff;border:1px solid #e8eaed;border-radius:8px;padding:14px 18px;margin:4px;min-width:140px;text-align:center"><div style="font-size:22px;font-weight:700;color:#185FA5">${v}</div><div style="font-size:11px;color:#999;margin-top:4px">${l}</div></div>`
  const includes = (m: string) => s.metricas.includes(m)
  const fmtBRL = (n: number) => 'R$ ' + Number(n).toLocaleString('pt-BR')

  const camps = (d.campanhas || []).map((c: any) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${c.nome}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${c.plataforma}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${fmtBRL(c.investido)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${c.ctr}%</td>
      <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-weight:600;color:${c.roas >= 3.5 ? '#3B6D11' : '#A32D2D'}">${c.roas}x</td>
    </tr>`).join('')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${s.nome}</title></head>
    <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8f9fb;color:#1a1a1a;padding:24px;margin:0">
    <div style="max-width:700px;margin:0 auto">
      <h1 style="font-size:20px;margin-bottom:4px">${s.nome}</h1>
      <p style="color:#888;font-size:12px;margin:0 0 20px">Gerado em ${todayBR()} · período: ${s.periodo_dados}</p>

      <div style="background:#fff;border:1px solid #eaeaea;border-radius:12px;padding:18px;margin-bottom:14px">
        <h2 style="font-size:14px;margin:0 0 12px">Indicadores principais</h2>
        ${includes('roas')         ? k('ROAS',         d.roas + 'x') : ''}
        ${includes('roi')          ? k('ROI',          d.roi + '%') : ''}
        ${includes('ctr')          ? k('CTR Meta',     d.ctrMeta + '%') : ''}
        ${includes('ctr')          ? k('CTR Google',   d.ctrGoogle + '%') : ''}
        ${includes('mensagens')    ? k('Mensagens',    d.mensagens) : ''}
        ${includes('agendamentos') ? k('Agendamentos', d.agendamentos) : ''}
        ${includes('vendas')       ? k('Vendas',       d.vendas) : ''}
        ${includes('investimento') ? k('Investimento', fmtBRL(d.investimento)) : ''}
        ${includes('receita')      ? k('Receita',      fmtBRL(d.receita)) : ''}
      </div>

      ${includes('campanhas') && d.campanhas?.length ? `
      <div style="background:#fff;border:1px solid #eaeaea;border-radius:12px;padding:18px;margin-bottom:14px">
        <h2 style="font-size:14px;margin:0 0 12px">Campanhas</h2>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#fafafa">
            <th style="text-align:left;padding:6px 10px;color:#999;font-weight:500">Nome</th>
            <th style="text-align:left;padding:6px 10px;color:#999;font-weight:500">Plat.</th>
            <th style="text-align:left;padding:6px 10px;color:#999;font-weight:500">Invest.</th>
            <th style="text-align:left;padding:6px 10px;color:#999;font-weight:500">CTR</th>
            <th style="text-align:left;padding:6px 10px;color:#999;font-weight:500">ROAS</th>
          </tr></thead>
          <tbody>${camps}</tbody>
        </table>
      </div>` : ''}

      <p style="font-size:11px;color:#999;text-align:center;margin-top:20px">
        Você está recebendo este e-mail porque foi cadastrado no agendamento <strong>${s.nome}</strong>.
      </p>
    </div>
    </body></html>`
}

async function sendViaResend(to: string[], subject: string, html: string) {
  if (!RESEND_KEY) throw new Error('RESEND_API_KEY não configurada')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend ${res.status}: ${text}`)
  }
  return res.json()
}

// Resumo em texto puro para WhatsApp (a Cloud API não aceita HTML)
function buildWhatsappText(s: Schedule, d: any): string {
  if (!d) return `📊 *${s.nome}*\n\nSem dados para o período "${s.periodo_dados}".`
  const inc = (m: string) => s.metricas.includes(m)
  const fmtBRL = (n: number) => 'R$ ' + Number(n).toLocaleString('pt-BR')
  const linhas = [`📊 *${s.nome}*`, `_${todayBR()} · período: ${s.periodo_dados}_`, '']
  if (inc('roas'))         linhas.push(`• ROAS: *${d.roas}x*`)
  if (inc('roi'))          linhas.push(`• ROI: *${d.roi}%*`)
  if (inc('ctr'))          linhas.push(`• CTR Meta: *${d.ctrMeta}%* · Google: *${d.ctrGoogle}%*`)
  if (inc('mensagens'))    linhas.push(`• Mensagens: *${d.mensagens}*`)
  if (inc('agendamentos')) linhas.push(`• Agendamentos: *${d.agendamentos}*`)
  if (inc('vendas'))       linhas.push(`• Vendas: *${d.vendas}*`)
  if (inc('investimento')) linhas.push(`• Investimento: *${fmtBRL(d.investimento)}*`)
  if (inc('receita'))      linhas.push(`• Receita: *${fmtBRL(d.receita)}*`)
  linhas.push('', '_Enviado automaticamente pelo Backoffice The Blonde Concept._')
  return linhas.join('\n')
}

// Envia via WhatsApp Cloud API (Meta).
// Atenção: mensagem de texto livre só chega se o número iniciou conversa
// nas últimas 24h. Para envio proativo confiável, use um template aprovado.
async function sendViaWhatsApp(numero: string, texto: string) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    throw new Error('WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID não configurados')
  }
  const res = await fetch(`https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: numero,
      type: 'text',
      text: { body: texto },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`WhatsApp ${res.status}: ${text}`)
  }
  return res.json()
}
