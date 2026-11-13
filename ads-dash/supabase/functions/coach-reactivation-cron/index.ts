// Supabase Edge Function — coach-reactivation-cron
//
// Roda em pg_cron (2x/dia). Seleciona threads dormentes (lead/aberta, ultima
// atividade ≥ 48h), aplica o coach de conversão, filtra os "quente/morno" não-B2B
// e insere RASCUNHOS de reativação em public.coach_rascunhos com status='pending'.
//
// IMPORTANTE: esta função NUNCA envia mensagens. Ela só enfileira sugestões
// pra revisão humana. O envio real é feito pelo atendente clicando "Aprovar
// e enviar" no front, que chama a função `inbox-reply`.
//
// Variáveis de ambiente (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   OPENAI_API_KEY
//   COACH_CRON_SECRET          header x-cron-secret pra barrar invocação externa
//
// Deploy:
//   supabase functions deploy coach-reactivation-cron --no-verify-jwt
//
// Agendamento (SQL):
//   select cron.schedule('coach-reactivation-manha', '0 12 * * *', ...);
//   select cron.schedule('coach-reactivation-tarde', '0 17 * * *', ...);
//   (horários em UTC → 9h e 14h BRT)
//
// Body opcional:
//   { "tenant_id": "uuid", "dry_run": false }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_KEY   = Deno.env.get('OPENAI_API_KEY')!
const CRON_SECRET  = Deno.env.get('COACH_CRON_SECRET')

const TENANT_DEFAULT = '31cc6350-d721-477d-bac6-3d5d8c907582'  // the-blonde-concept
const MODEL = 'gpt-4o'
const MAX_THREADS_POR_RUN = 50
const SCORE_MINIMO = 45           // só gera rascunho pra score ≥ 45 (morno pra cima)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface Candidata {
  thread_id: string
  contato_nome: string | null
  contato_phone: string
  status: string
  origem: string
  ultima_atividade: string
  inbox_phone: string | null
}

interface MsgReal {
  autor: 'cliente' | 'atendente'
  texto: string
  hora: string
}

interface CoachResult {
  score_lead?: number
  tag_sugerida?: 'quente' | 'morno' | 'frio'
  nao_comercial?: boolean
  ja_resolvido?: boolean
  motivo_ja_resolvido?: string
  primeiro_nome?: string
  resumo?: string
  proxima_resposta?: string
  reativacao_necessaria?: boolean
}

// ---- cópia enxuta do prompt do coach (SÓ as partes que importam pra
// reativação). Replica regra 16/17/18/20. ----
function buildPrompt(thread: Candidata, msgs: MsgReal[], brain: Record<string, string>): string {
  const recentes = msgs.slice(-60)
  const transcricao = recentes
    .map((m) => `[${new Date(m.hora).toLocaleString('pt-BR')}] ${m.autor === 'cliente' ? 'CLIENTE' : 'ATENDENTE'}: ${m.texto}`)
    .join('\n')
  const nome = thread.contato_nome || thread.contato_phone

  return `Você é um coach de vendas sênior em WhatsApp Business de salão premium. Analise a conversa dormente abaixo e gere uma mensagem de REATIVAÇÃO afiada, no tom da marca, pronta pra enviar.

CONTEXTO DA MARCA:
NORTE: ${brain?.norte ?? '-'}
PÚBLICO: ${brain?.publico_alvo ?? '-'}
TOM DE VOZ: ${brain?.tom_de_voz ?? '-'}
OFERTAS: ${brain?.ofertas_atuais ?? '-'}
DIFERENCIAIS: ${brain?.diferenciais ?? '-'}
EVITAR: ${brain?.evitar ?? '-'}
PALAVRAS-CHAVE: ${brain?.palavras_chave ?? '-'}

CONTATO: ${nome} (${thread.contato_phone}) · status: ${thread.status}

TRANSCRIÇÃO COMPLETA (mais antigas em cima):
${transcricao || '(sem mensagens)'}

Responda SOMENTE com JSON válido:
{
  "score_lead": <inteiro 0-100>,
  "tag_sugerida": "quente|morno|frio",
  "nao_comercial": true|false,
  "ja_resolvido": true|false,
  "motivo_ja_resolvido": "<string curta quando ja_resolvido=true, senão vazio>",
  "primeiro_nome": "<ou string vazia>",
  "resumo": "<1 frase sobre o estado da conversa>",
  "proxima_resposta": "<mensagem PRONTA de reativação, 1-3 frases, em pt-BR, tom da marca>",
  "reativacao_necessaria": true|false
}

REGRAS (leia a conversa INTEIRA antes de decidir):

1. ja_resolvido=true quando o thread NÃO é um lead ativo dormente — ou seja, quando QUALQUER dessas condições apareceu na transcrição:
   (a) Agendamento confirmado: atendente disse "Agendado dia X/Y às HHh", "Confirmado pro dia...", "Marcado pro dia...", "Remarcado pro dia...", ou algo equivalente com DATA e HORA específicas, E o cliente não contestou depois.
   (b) Cliente confirmou presença: "pode agendar", "confirmo o horário", "tá marcado", "fechado".
   (c) Pagamento já combinado / dados PIX enviados e aceitos.
   (d) Cliente declarou que foi atendido ("já fiz", "já passei", "obrigada pelo atendimento").
   (e) Cliente declarou NÃO explicitamente ("agendei em outro lugar", "mudei de ideia", "não posso mais", "cancelei").
   (f) Thread é B2B / parceria / spam.
   Nesses casos: reativacao_necessaria=false, proxima_resposta="" (string vazia), motivo_ja_resolvido explica em 1 frase. NÃO gere mensagem de reativação em NENHUMA dessas situações. É FUNDAMENTAL: nossa recepcionista vai receber a mensagem e mandar pra cliente — se mandar "voltando aqui, posso reservar seu horário" pra alguém que JÁ ESTÁ AGENDADA, a marca queima.

2. ja_resolvido=false SÓ quando o lead está realmente dormente e ainda pode converter: pediu info e sumiu, foi qualificado mas não agendou, perguntou preço e não respondeu depois, etc.

3. NUNCA inventar preço, horário, nome de profissional ou promoção que não apareceu LITERALMENTE no brain ou na transcrição.

4. Se cliente de fora da região ou com barreira logística declarada: reconhecer a barreira, não forçar visita.

5. REATIVAÇÃO FORTE: quando reativacao_necessaria=true, a proxima_resposta DEVE abrir reconhecendo o tempo que passou ("Oi X, voltando aqui com você...", "Oi, retomando nosso papo"). Nunca "Que ótimo ter você por aqui" quando é reativação.

6. Se lead novo sem qualificação ainda (≤4 msgs, atendente não perguntou "qual resultado você procura"): a proxima_resposta qualifica SEM oferta no mesmo ping.

7. Score_lead: 90+ pediu agenda/aceitou valor; 70-89 pediu preço/referência; 50-69 curioso; 30-49 sumiu depois de info; 0-29 frio/B2B/declarou NÃO/já resolvido.

8. tag_sugerida=quente se score ≥75; morno se 45-74; frio se <45. Se ja_resolvido=true: tag=frio e score≤30.

9. primeiro_nome: use o primeiro nome real se houver (ignorar emoji, "~", "cliente").

10. proxima_resposta: 1-3 frases, direto, tom acolhedor, sem floreios, sem desculpar demais. Se ja_resolvido=true, string vazia.`
}

async function chamarCoach(thread: Candidata, msgs: MsgReal[], brain: Record<string, string>): Promise<CoachResult | null> {
  const prompt = buildPrompt(thread, msgs, brain)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Você é um coach de vendas sênior em WhatsApp Business premium. Afiado, direto. Responda sempre em JSON válido.' },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || '{}'
    return JSON.parse(text) as CoachResult
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Barra invocação externa. pg_cron passa o header configurado.
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }

  const body = await req.json().catch(() => ({})) as { tenant_id?: string; dry_run?: boolean }
  const tenantId = body.tenant_id || TENANT_DEFAULT
  const dryRun   = !!body.dry_run

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1) Verifica flag no ai_brain — se desligado, aborta
  const { data: brainRow } = await admin
    .from('ai_brain')
    .select('payload')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  const brain = (brainRow?.payload ?? {}) as Record<string, any>
  if (brain.reativacao_auto_ativa === false) {
    return json({ ok: true, aborted: true, motivo: 'reativacao_auto_ativa=false' })
  }

  // 2) Busca candidatas
  const { data: candidatas, error: errCand } = await admin.rpc('coach_reativacao_candidatas', {
    p_tenant_id: tenantId,
    p_min_horas: 48,
    p_max_horas: 24 * 14,
    p_dedup_horas: 48,
    p_limit: MAX_THREADS_POR_RUN,
  })
  if (errCand) return json({ error: `candidatas: ${errCand.message}` }, 500)

  const lista = (candidatas || []) as Candidata[]
  const resultados = {
    varridas: lista.length,
    rascunhos_criados: 0,
    descartadas_frio: 0,
    descartadas_b2b: 0,
    descartadas_ja_resolvido: 0,
    descartadas_score_baixo: 0,
    descartadas_sem_resposta: 0,
    erros: 0,
  }

  for (const cand of lista) {
    // Pega mensagens do thread
    const { data: msgsData } = await admin
      .from('whatsapp_msgs')
      .select('autor, texto, hora')
      .eq('thread_id', cand.thread_id)
      .order('hora', { ascending: true })
      .limit(100)

    const msgs = (msgsData || []) as MsgReal[]
    if (!msgs.length) {
      resultados.descartadas_sem_resposta++
      continue
    }

    const coach = await chamarCoach(cand, msgs, brain)
    if (!coach) { resultados.erros++; continue }

    if (coach.nao_comercial === true)            { resultados.descartadas_b2b++; continue }
    if (coach.ja_resolvido === true)             { resultados.descartadas_ja_resolvido++; continue }
    if (coach.reativacao_necessaria === false)   { resultados.descartadas_ja_resolvido++; continue }
    if (coach.tag_sugerida === 'frio')           { resultados.descartadas_frio++; continue }
    if ((coach.score_lead ?? 0) < SCORE_MINIMO)  { resultados.descartadas_score_baixo++; continue }
    if (!coach.proxima_resposta?.trim())         { resultados.descartadas_sem_resposta++; continue }

    if (dryRun) { resultados.rascunhos_criados++; continue }

    const { error: errIns } = await admin
      .from('coach_rascunhos')
      .insert({
        tenant_id:          tenantId,
        thread_id:          cand.thread_id,
        score_lead:         coach.score_lead ?? 0,
        tag_sugerida:       coach.tag_sugerida ?? 'morno',
        primeiro_nome:      coach.primeiro_nome || null,
        resumo_ia:          coach.resumo || null,
        mensagem_sugerida:  coach.proxima_resposta.trim(),
        analise_json:       coach as any,
        status:             'pending',
      })
    if (errIns) { resultados.erros++; continue }
    resultados.rascunhos_criados++
  }

  return json({ ok: true, tenant_id: tenantId, dry_run: dryRun, ...resultados })
})
