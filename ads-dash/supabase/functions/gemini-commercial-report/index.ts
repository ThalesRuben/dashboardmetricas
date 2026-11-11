// Supabase Edge Function — gemini-commercial-report
//
// Recebe KPIs agregados + amostra estratificada de conversas (vendas,
// agendadas, perdidas, SLA ruim) + brain da marca e devolve um diagnóstico
// macro do comercial no WhatsApp: pontos fortes, pontos de melhoria,
// padrões recorrentes e ações prioritárias.
//
// Variáveis de ambiente:
//   OPENAI_API_KEY   chave da API da OpenAI (mesma usada pelo gemini-inbox-coach)
//
// Deploy:
//   supabase functions deploy gemini-commercial-report --no-verify-jwt

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const MODEL = 'gpt-4o-mini'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface SampleMsg {
  autor: 'cliente' | 'atendente'
  texto: string
  hora: string
}

interface SampleThread {
  contato_nome: string | null
  contato_phone: string
  status: string
  origem: string
  criado_em: string
  ultima_atividade: string
  ultima_msg_cliente_em: string | null
  msgs: SampleMsg[]
}

interface Kpis {
  conversas: number
  leads: number
  agendamentos: number
  taxa_resposta: number
  tempo_resposta_min: number
  pct_sla_resposta: number
  tempo_resposta_turno_min: number
  taxa_conversao: number
  ticket_medio: number
}

interface Amostras {
  vendas: SampleThread[]
  agendadas: SampleThread[]
  perdidas: SampleThread[]
  sla_ruim: SampleThread[]
}

interface Payload {
  periodo: { from: string; to: string }
  inbox_phone: string | null
  kpis: Kpis
  amostras: Amostras
  brain?: Record<string, string>
}

function fmtMsgs(msgs: SampleMsg[], maxChars = 1500): string {
  const take = msgs.slice(-20)
  let out = ''
  for (const m of take) {
    const hora = new Date(m.hora).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    const line = `[${hora}] ${m.autor === 'cliente' ? 'CLIENTE' : 'ATENDENTE'}: ${m.texto}\n`
    if ((out + line).length > maxChars) { out += '[...]\n'; break }
    out += line
  }
  return out.trim()
}

function fmtBucket(label: string, threads: SampleThread[]): string {
  if (threads.length === 0) return `\n### ${label}: (nenhuma no período)\n`
  const blocks = threads.map((t, i) => {
    const nome = t.contato_nome || t.contato_phone
    return `#${i + 1} — ${nome} · status=${t.status} · origem=${t.origem} · criada=${new Date(t.criado_em).toLocaleDateString('pt-BR')}
${fmtMsgs(t.msgs)}`
  })
  return `\n### ${label} (${threads.length}):\n${blocks.join('\n---\n')}\n`
}

function buildPrompt(p: Payload): string {
  const b = p.brain || {}
  const de = new Date(p.periodo.from).toLocaleDateString('pt-BR')
  const ate = new Date(p.periodo.to).toLocaleDateString('pt-BR')
  const k = p.kpis

  return `Você é um diretor comercial sênior especialista em atendimento via WhatsApp. Sua tarefa: diagnosticar o estado do atendimento comercial do cliente neste período e entregar um relatório executivo acionável.

CONTEXTO DA MARCA (use isso pra calibrar tom, oferta e diferencial):
NORTE: ${b.norte ?? '-'}
PÚBLICO: ${b.publico_alvo ?? '-'}
TOM DE VOZ: ${b.tom_de_voz ?? '-'}
OFERTAS: ${b.ofertas_atuais ?? '-'}
DIFERENCIAIS: ${b.diferenciais ?? '-'}
EVITAR: ${b.evitar ?? '-'}

PERÍODO ANALISADO: ${de} → ${ate}
INBOX: ${p.inbox_phone ?? 'todos os números'}

KPIs AGREGADOS DO PERÍODO:
- Conversas: ${k.conversas}
- Leads (status "lead"): ${k.leads}
- Agendamentos: ${k.agendamentos}
- Taxa de resposta: ${k.taxa_resposta?.toFixed?.(1) ?? k.taxa_resposta}%
- Tempo até 1ª resposta (mediana): ${k.tempo_resposta_min} min
- % dentro do SLA ≤10min: ${k.pct_sla_resposta?.toFixed?.(1) ?? k.pct_sla_resposta}%
- Tempo médio entre turnos (mediana): ${k.tempo_resposta_turno_min} min
- Taxa de conversão: ${k.taxa_conversao?.toFixed?.(1) ?? k.taxa_conversao}%
- Ticket médio (R$): ${k.ticket_medio}

AMOSTRA ESTRATIFICADA DE CONVERSAS:
${fmtBucket('VENDAS (o que está dando certo)', p.amostras.vendas)}
${fmtBucket('AGENDADAS (em andamento)', p.amostras.agendadas)}
${fmtBucket('PERDIDAS — leads/abertas sem resposta há mais de 24h', p.amostras.perdidas)}
${fmtBucket('SLA RUIM — clientes esperando resposta há tempo', p.amostras.sla_ruim)}

Sua tarefa: analise o conjunto (NÃO conversa por conversa) e devolva um diagnóstico macro. Compare o que acontece nas vendas vs nas perdidas. Procure padrões: objeções não tratadas, respostas genéricas, atrasos, oportunidades de upsell/cross-sell que nunca são ofertadas, scripts que funcionam, scripts que afastam.

Responda SOMENTE com um objeto JSON válido (sem markdown, sem \`\`\`) neste formato:
{
  "modelo": "${MODEL}",
  "resumo": "<2-3 frases: estado geral do comercial no período, com o número mais chamativo (bom ou ruim)>",
  "pontos_fortes": [
    "<ponto forte observado concretamente nas amostras (cite comportamento, não elogio genérico)>"
  ],
  "pontos_melhoria": [
    {
      "titulo": "<título curto e específico, ex: 'Respostas iniciais muito longas'>",
      "descricao": "<1-3 frases explicando o problema, com referência concreta às conversas vistas>",
      "prioridade": "alta|media|baixa"
    }
  ],
  "padroes": [
    {
      "padrao": "<padrão recorrente observado em várias conversas>",
      "exemplos_resumidos": ["<ex 1>", "<ex 2>"]
    }
  ],
  "acoes_prioritarias": [
    {
      "acao": "<ação concreta que o gestor pode aplicar essa semana>",
      "impacto_esperado": "<qual KPI melhora e quanto, em termos práticos>"
    }
  ]
}

Regras:
- 3 a 6 itens em "pontos_melhoria", ordenados do mais crítico pro menos. Priorize o que afeta conversão.
- 2 a 5 "pontos_fortes". Se não houver, retorne array vazio — não invente.
- 2 a 4 "padroes" — são comportamentos repetidos (ex: "atendente responde preço antes de explorar necessidade").
- 3 a 5 "acoes_prioritarias" — concretas, executáveis essa semana. Nada vago tipo "melhorar atendimento".
- Fale da equipe ("o time"), não do cliente. Tom direto, consultivo, sem floreio.
- Em pt-BR. Nunca invente dados (preço, nome, oferta) que não apareçam na amostra ou no contexto da marca.
- Se amostra for muito pequena pra tirar padrão, diga isso em "resumo" e mantenha arrays curtos.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY não configurada.' }, 400)
  }

  try {
    const payload = (await req.json()) as Payload
    if (!payload?.kpis || !payload?.amostras || !payload?.periodo) {
      return json({ error: 'payload precisa de kpis, amostras e periodo' }, 400)
    }

    const prompt = buildPrompt(payload)

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Você é um diretor comercial sênior analisando atendimento via WhatsApp. Responda sempre em JSON válido, sem markdown.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return json({ error: `OpenAI ${res.status}: ${data.error?.message || 'erro'}` }, 502)
    }

    const text = data.choices?.[0]?.message?.content || '{}'
    const report = JSON.parse(text)
    report.gerado_em = new Date().toISOString()
    report.amostra_contagem = {
      vendas: payload.amostras.vendas.length,
      agendadas: payload.amostras.agendadas.length,
      perdidas: payload.amostras.perdidas.length,
      sla_ruim: payload.amostras.sla_ruim.length,
    }
    return json(report)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
