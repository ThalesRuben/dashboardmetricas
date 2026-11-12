// Supabase Edge Function — gemini-commercial-report
//
// Recebe KPIs agregados + amostra estratificada de conversas (vendas,
// agendadas, perdidas, SLA ruim) + horizonte (diário/semanal/quinzenal/mensal)
// + brain da marca e devolve um diagnóstico macro do comercial no WhatsApp:
// pontos fortes, pontos de melhoria, padrões, metas do horizonte, playbook
// comercial completo (velocidade, qualificação, follow-up, objeções, upsell,
// reativação, prospecção, qualidade), rituais de gestão, scripts prontos e
// follow-ups urgentes.
//
// Variáveis de ambiente:
//   OPENAI_API_KEY   chave da API da OpenAI
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

type Horizonte = 'diario' | 'semanal' | 'quinzenal' | 'mensal'

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
  horizonte?: Horizonte
  inbox_phone: string | null
  kpis: Kpis
  amostras: Amostras
  brain?: Record<string, string>
}

const HORIZONTE_META: Record<Horizonte, {
  label: string
  cadencia: string
  foco: string
}> = {
  diario: {
    label: 'DIÁRIO',
    cadencia: 'Hoje. Ações pra executar nas próximas horas, antes de fechar o dia.',
    foco: 'SLA de resposta, follow-up do dia, leads quentes esquecidos e agenda do dia seguinte. Sem projetos longos.',
  },
  semanal: {
    label: 'SEMANAL',
    cadencia: 'Nesta semana (próximos 5-7 dias úteis).',
    foco: 'Correção de gargalos, treinamento rápido do time, cadência de follow-up, revisão de scripts e meta semanal de conversão.',
  },
  quinzenal: {
    label: 'QUINZENAL',
    cadencia: 'Próximas 2 semanas.',
    foco: 'Padronização de playbook, reativação de leads frios, teste A/B de scripts, revisão de rituais e primeiros ajustes estruturais.',
  },
  mensal: {
    label: 'MENSAL',
    cadencia: 'Próximo mês comercial inteiro.',
    foco: 'Metas de mês (receita/ticket/conversão), decisões estruturais (processos, templates, segmentação, ofertas), revisão com liderança e evolução da equipe.',
  },
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
    return `#${i + 1} — ${nome} · telefone=${t.contato_phone} · status=${t.status} · origem=${t.origem} · criada=${new Date(t.criado_em).toLocaleDateString('pt-BR')}
${fmtMsgs(t.msgs)}`
  })
  return `\n### ${label} (${threads.length}):\n${blocks.join('\n---\n')}\n`
}

function buildPrompt(p: Payload): string {
  const b = p.brain || {}
  const de = new Date(p.periodo.from).toLocaleDateString('pt-BR')
  const ate = new Date(p.periodo.to).toLocaleDateString('pt-BR')
  const k = p.kpis
  const horizonte: Horizonte = p.horizonte || 'semanal'
  const h = HORIZONTE_META[horizonte]

  return `Você é um DIRETOR COMERCIAL SÊNIOR especialista em alta performance de atendimento via WhatsApp. Já treinou times B2C de serviço, varejo e beleza/estética a baterem meta via WhatsApp. Sua missão hoje: montar um RELATÓRIO COMERCIAL de horizonte ${h.label} com playbook pronto pra executar.

HORIZONTE DO RELATÓRIO: ${h.label}
CADÊNCIA DAS AÇÕES: ${h.cadencia}
FOCO ESPERADO: ${h.foco}

CONTEXTO DA MARCA (use isso pra calibrar tom, oferta e diferencial):
NORTE: ${b.norte ?? '-'}
PÚBLICO: ${b.publico_alvo ?? '-'}
TOM DE VOZ: ${b.tom_de_voz ?? '-'}
OFERTAS: ${b.ofertas_atuais ?? '-'}
DIFERENCIAIS: ${b.diferenciais ?? '-'}
EVITAR: ${b.evitar ?? '-'}

PERÍODO ANALISADO: ${de} → ${ate}
INBOX: ${p.inbox_phone ?? 'todos os números'}

KPIs AGREGADOS DO PERÍODO (${h.label.toLowerCase()}):
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

INSTRUÇÕES DE ANÁLISE:
- Compare o que acontece nas VENDAS vs nas PERDIDAS. O que foi feito diferente?
- Nas SLA RUIM e PERDIDAS, identifique cliente real + telefone pra sugerir follow-up imediato.
- Procure padrões: objeções não tratadas, respostas genéricas, atrasos crônicos, oportunidades de upsell/cross-sell que nunca são ofertadas, scripts que funcionam, scripts que afastam.
- Toda ação precisa ser factível DENTRO do horizonte (${h.label}). Não sugira projeto de 60 dias num relatório diário.
- Tom direto, consultivo, de diretor comercial falando com o dono. Sem floreio, sem corporativês.
- Fale da EQUIPE ("o time", "os atendentes"), não do cliente final.
- Em pt-BR brasileiro. Nunca invente dados (preço, nome, oferta) que não apareçam na amostra ou no contexto da marca.

Responda SOMENTE com um objeto JSON válido (sem markdown, sem \`\`\`) neste formato exato:
{
  "modelo": "${MODEL}",
  "horizonte": "${horizonte}",
  "resumo": "<2-3 frases: estado geral do comercial no horizonte ${h.label}, destacando o número mais chamativo (bom ou ruim) e a decisão mais urgente>",
  "diagnostico_executivo": "<parágrafo de 4-6 linhas no tom de diretor comercial: o que está acontecendo, por que, o que vai quebrar se nada mudar e qual a aposta pro horizonte>",
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
  "metas_horizonte": [
    {
      "kpi": "<KPI, ex: 'SLA ≤10min' ou 'Taxa de conversão' ou 'Agendamentos'>",
      "atual": "<valor atual com unidade, ex: '62%' ou '14 min' ou '8 agendamentos'>",
      "meta": "<meta pro fim do horizonte, ex: '85%' ou '≤5 min' ou '15 agendamentos'>",
      "gap": "<frase curta explicando o que fechar o gap exige, ex: 'responder na pausa de almoço' ou 'tirar 2 scripts longos do fluxo'>"
    }
  ],
  "acoes_prioritarias": [
    {
      "acao": "<ação concreta exequível no horizonte ${h.label}>",
      "impacto_esperado": "<qual KPI melhora e quanto, em termos práticos>"
    }
  ],
  "playbook_comercial": [
    {
      "categoria": "velocidade_sla|qualificacao|follow_up|objecoes|upsell_cross|reativacao|prospeccao|qualidade",
      "jogada": "<nome curto da jogada, ex: 'Ping de 10 min' ou 'Discovery em 3 perguntas'>",
      "como_executar": "<2-4 frases passo-a-passo de como o time executa>",
      "quando": "<quando aplicar: 'todo lead novo', 'após 24h sem resposta', 'sexta à tarde'…>",
      "dono_sugerido": "<quem executa: 'cada atendente', 'líder comercial', 'dono/gestor'>",
      "kpi_afetado": "<KPI que essa jogada move>",
      "prioridade": "alta|media|baixa"
    }
  ],
  "rituais_gestao": [
    {
      "ritual": "<nome do ritual, ex: 'Daily de 10 min' ou 'Revisão de perdidos' ou '1:1 com atendente'>",
      "frequencia": "<diário|semanal|quinzenal|mensal>",
      "duracao": "<ex: '10 min' ou '45 min'>",
      "pauta": "<o que revisar nesse ritual, em 1-2 frases diretas>"
    }
  ],
  "scripts_recomendados": [
    {
      "situacao": "<situação concreta, ex: 'Primeira resposta a lead de anúncio' ou 'Objeção de preço' ou 'Reativação de lead frio de 15 dias'>",
      "script": "<texto do script pronto pra copiar/colar no WhatsApp, em pt-BR, no tom da marca, com placeholders tipo {nome} ou {procedimento} quando necessário>",
      "observacao": "<1 frase de contexto/dica de uso, pode ser vazia>"
    }
  ],
  "follow_ups_imediatos": [
    {
      "contato": "<nome do contato (ou telefone, se nome não aparece)>",
      "telefone": "<telefone completo com DDI/DDD, ou null se não houver>",
      "motivo": "<por que fazer esse follow-up, ex: 'lead esfriou há 36h depois de pedir preço'>",
      "acao_sugerida": "<o que exatamente fazer/dizer>",
      "janela_ideal": "<quando contatar, ex: 'hoje antes das 19h' ou 'amanhã de manhã'>"
    }
  ]
}

REGRAS DE SAÍDA:
- "pontos_fortes": 2 a 5 itens. Se não houver, retorne array vazio — não invente.
- "pontos_melhoria": 3 a 6, ordenados do mais crítico pro menos. Priorize o que afeta conversão.
- "padroes": 2 a 4 comportamentos repetidos observados.
- "metas_horizonte": 3 a 5 KPIs. Use SEMPRE os números reais dos KPIs fornecidos como "atual".
- "acoes_prioritarias": 3 a 5 ações top, concretas, executáveis no horizonte ${h.label}.
- "playbook_comercial": 6 a 12 jogadas no total, COBRINDO PELO MENOS 5 das 8 categorias (velocidade_sla, qualificacao, follow_up, objecoes, upsell_cross, reativacao, prospeccao, qualidade). Prioriza as categorias com maior gap observado.
- "rituais_gestao": 3 a 5 rituais calibrados pro horizonte (ex: relatório diário → daily; mensal → fechamento de mês).
- "scripts_recomendados": 3 a 6 scripts que resolvem as situações mais críticas observadas nas conversas perdidas.
- "follow_ups_imediatos": 3 a 8 contatos REAIS extraídos da amostra (PERDIDAS e SLA_RUIM). Use nome e telefone que aparecem na amostra. Se a amostra não tiver follow-ups óbvios, retorne array vazio.
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
    report.horizonte = payload.horizonte || 'semanal'
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
