// Supabase Edge Function — gemini-inbox-coach
//
// [NOME MANTIDO POR COMPATIBILIDADE COM O FRONT — provider é OpenAI]
//
// Recebe uma conversa do WhatsApp (thread + msgs + contexto do CRM) e devolve
// sugestões da IA pra aumentar conversão: próxima resposta pronta pra colar,
// análise do estado da conversa, score do lead, objeções abertas, sinais de
// compra, oportunidades perdidas e próximos passos.
//
// A IA SÓ SUGERE — quem decide enviar é o atendente humano no painel.
//
// Variáveis de ambiente (Supabase → Edge Functions → Secrets):
//   OPENAI_API_KEY   chave da API da OpenAI
//
// Deploy:
//   supabase functions deploy gemini-inbox-coach --no-verify-jwt
//
// Uso (no app):
//   supabase.functions.invoke('gemini-inbox-coach', {
//     body: { thread, msgs, brain, crm_contexto }
//   })

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const MODEL = 'gpt-4o'

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

interface MsgInput {
  autor: 'cliente' | 'atendente'
  texto: string
  hora: string
}
interface ThreadInput {
  contato_nome: string | null
  contato_phone: string
  status: string
  origem: string
}

// Contexto do CRM que o front pode passar pra IA levar em conta
// (notas internas, tags, follow-ups pendentes, vendas passadas).
// Tudo opcional — a IA deve se virar mesmo sem CRM.
interface CrmContextoInput {
  cliente_recorrente?: boolean
  vendas_passadas?: { servico: string; valor: number; data: string }[]
  notas?: { texto: string; criado_em: string }[]
  tags?: string[]
  followups_pendentes?: { data: string; motivo: string | null }[]
}

interface AnaliseTempoCalc {
  total_msgs: number
  msgs_cliente: number
  msgs_atendente: number
  // Minutos entre o INÍCIO de cada burst do cliente e a primeira resposta do atendente.
  gaps_resposta_min: number[]
  gap_medio_min: number | null
  pior_gap_min: number | null
  // HH:MM (America/Sao_Paulo) de cada resposta do atendente — perfil de horário.
  horarios_atendente: string[]
  // Minutos desde a última msg até agora.
  inatividade_atual_min: number | null
  ultima_msg_autor: 'cliente' | 'atendente' | null
  ultima_msg_hora: string | null
  // Atalhos pra IA — a IA ainda pode discordar.
  lead_frio: boolean           // >24h sem mensagem nenhuma
  atendente_sumiu: boolean     // última msg é do cliente e passou >2h
}

function calcAnaliseTempo(msgs: MsgInput[]): AnaliseTempoCalc {
  const ordenadas = [...msgs]
    .filter((m) => m && m.hora)
    .sort((a, b) => new Date(a.hora).getTime() - new Date(b.hora).getTime())

  const gaps: number[] = []
  const horariosAt: string[] = []
  let clienteBurstInicio: string | null = null

  for (const m of ordenadas) {
    if (m.autor === 'cliente') {
      if (clienteBurstInicio === null) clienteBurstInicio = m.hora
    } else {
      // atendente
      if (clienteBurstInicio !== null) {
        const gap =
          (new Date(m.hora).getTime() - new Date(clienteBurstInicio).getTime()) / 60000
        if (Number.isFinite(gap) && gap >= 0) gaps.push(gap)
        clienteBurstInicio = null
      }
      try {
        horariosAt.push(
          new Date(m.hora).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          }),
        )
      } catch {
        // ignora datas inválidas
      }
    }
  }

  const msgsCliente = ordenadas.filter((m) => m.autor === 'cliente').length
  const msgsAtendente = ordenadas.filter((m) => m.autor === 'atendente').length
  const ultima = ordenadas[ordenadas.length - 1] ?? null
  const inatividadeMin = ultima
    ? (Date.now() - new Date(ultima.hora).getTime()) / 60000
    : null
  const gapMedio = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
  const piorGap = gaps.length ? Math.max(...gaps) : null

  return {
    total_msgs: ordenadas.length,
    msgs_cliente: msgsCliente,
    msgs_atendente: msgsAtendente,
    gaps_resposta_min: gaps.map((g) => Math.round(g)),
    gap_medio_min: gapMedio !== null ? Math.round(gapMedio) : null,
    pior_gap_min: piorGap !== null ? Math.round(piorGap) : null,
    horarios_atendente: horariosAt,
    inatividade_atual_min: inatividadeMin !== null ? Math.round(inatividadeMin) : null,
    ultima_msg_autor: ultima?.autor ?? null,
    ultima_msg_hora: ultima?.hora ?? null,
    lead_frio: inatividadeMin !== null && inatividadeMin > 24 * 60,
    atendente_sumiu:
      !!ultima && ultima.autor === 'cliente' && (inatividadeMin ?? 0) > 120,
  }
}

function fmtMin(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return '-'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
  const d = Math.floor(h / 24)
  const hr = h % 24
  return hr ? `${d}d ${hr}h` : `${d}d`
}

function fmtCurrency(cents: number): string {
  const v = (cents || 0) / 100
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function buildCrmBlock(crm: CrmContextoInput | undefined): string {
  if (!crm) return 'CRM: (sem contexto carregado — tratar como primeiro contato)'
  const linhas: string[] = []
  linhas.push(`- Cliente recorrente: ${crm.cliente_recorrente ? 'SIM' : 'não'}`)
  if (crm.vendas_passadas?.length) {
    const resumo = crm.vendas_passadas
      .slice(0, 5)
      .map((v) => `${v.data} · ${v.servico} · ${fmtCurrency(v.valor)}`)
      .join(' | ')
    linhas.push(`- Vendas passadas (${crm.vendas_passadas.length}): ${resumo}`)
  } else {
    linhas.push('- Vendas passadas: nenhuma')
  }
  if (crm.tags?.length) {
    linhas.push(`- Tags: ${crm.tags.join(', ')}`)
  }
  if (crm.notas?.length) {
    const ultimas = crm.notas.slice(0, 3)
      .map((n) => `"${n.texto.replace(/\s+/g, ' ').slice(0, 220)}"`)
      .join(' · ')
    linhas.push(`- Notas internas (mais recentes): ${ultimas}`)
  }
  if (crm.followups_pendentes?.length) {
    const resumo = crm.followups_pendentes
      .slice(0, 3)
      .map((f) => `${f.data}${f.motivo ? ` (${f.motivo})` : ''}`)
      .join(' | ')
    linhas.push(`- Follow-ups pendentes: ${resumo}`)
  }
  return linhas.join('\n')
}

function buildPrompt(
  thread: ThreadInput,
  msgs: MsgInput[],
  brain: Record<string, string>,
  crm: CrmContextoInput | undefined,
) {
  // Limita a 60 msgs mais recentes pra não estourar contexto.
  const recentes = msgs.slice(-60)
  const transcricao = recentes
    .map((m) => `[${new Date(m.hora).toLocaleString('pt-BR')}] ${m.autor === 'cliente' ? 'CLIENTE' : 'ATENDENTE'}: ${m.texto}`)
    .join('\n')

  const nome = thread.contato_nome || thread.contato_phone
  const t = calcAnaliseTempo(recentes)
  const crmBlock = buildCrmBlock(crm)

  return `Você é um coach de vendas sênior especializado em WhatsApp Business de serviços premium (salão de beleza de alta performance). Sua missão: fazer cada atendente FECHAR MAIS VENDAS. Seja direto, afiado, comercial.

CONTEXTO DA MARCA (use isso pra calibrar tom e oferta):
NORTE: ${brain?.norte ?? '-'}
PÚBLICO: ${brain?.publico_alvo ?? '-'}
TOM DE VOZ: ${brain?.tom_de_voz ?? '-'}
OFERTAS: ${brain?.ofertas_atuais ?? '-'}
DIFERENCIAIS: ${brain?.diferenciais ?? '-'}
EVITAR: ${brain?.evitar ?? '-'}
PALAVRAS-CHAVE: ${brain?.palavras_chave ?? '-'}

CONVERSA:
- Contato: ${nome} (${thread.contato_phone})
- Status atual: ${thread.status}
- Origem: ${thread.origem}

${crmBlock}

MÉTRICAS DE TEMPO (já calculadas, fuso America/Sao_Paulo):
- Mensagens: ${t.total_msgs} (cliente: ${t.msgs_cliente}, atendente: ${t.msgs_atendente})
- Gaps cliente→atendente (min): [${t.gaps_resposta_min.join(', ') || '—'}]
- Gap médio: ${fmtMin(t.gap_medio_min)} · Pior gap: ${fmtMin(t.pior_gap_min)}
- Horários em que o atendente respondeu: [${t.horarios_atendente.join(', ') || '—'}]
- Última mensagem foi do: ${t.ultima_msg_autor ?? '—'} · há ${fmtMin(t.inatividade_atual_min)}
- Sinal lead frio (>24h sem resposta): ${t.lead_frio ? 'SIM' : 'não'}
- Sinal atendente sumiu (cliente mandou por último e passou >2h): ${t.atendente_sumiu ? 'SIM' : 'não'}

TRANSCRIÇÃO (mais antigas em cima):
${transcricao || '(sem mensagens)'}

Sua tarefa: analise o estado da conversa como um coach comercial exigente e devolva sugestões acionáveis pra fechar a venda ou avançar o lead. Responda SOMENTE com um objeto JSON válido (sem markdown, sem \`\`\`) neste formato:
{
  "modelo": "${MODEL}",
  "primeiro_nome": "<primeiro nome do cliente (use o 'Contato' ou o que a pessoa escreveu). Se não houver nome real (ex: emoji, '~', vazio), devolve string vazia.>",
  "resumo": "<1-2 frases sobre o estado da conversa: o que o cliente quer, em que ponto travou, quão perto está de fechar>",
  "score_lead": <inteiro 0-100 — probabilidade real de fechar venda nos próximos 7 dias. 90+: pediu horário/aceitou valor; 70-89: pediu preço/referência clara; 50-69: curioso, perguntou genericamente; 30-49: sumiu depois de info; 0-29: frio/pouco engajado/B2B>,
  "tag_sugerida": "quente|morno|frio",
  "nao_comercial": true|false,
  "sinais_de_compra": [
    "<frase citando sinal CONCRETO que o cliente deu — ex: 'perguntou se tem agenda em dezembro', 'disse que quer agendar', 'pediu preço do profissional X'. Vazio se não houver sinal real.>"
  ],
  "objecoes_abertas": [
    "<pergunta ou dúvida do cliente que ainda NÃO foi respondida pelo atendente — ex: 'perguntou preço das mechas e ainda não recebeu valor', 'quer saber horário dia 19/12'. Vazio se o atendente respondeu tudo.>"
  ],
  "proxima_resposta": "<mensagem PRONTA pra colar e enviar pelo WhatsApp. Curta (1-3 frases), em pt-BR, no tom da marca, usando o primeiro nome quando apropriado, com próximo passo CLARO e específico.>",
  "proximos_passos": [
    "<próxima ação concreta além da mensagem — ex: 'confirmar horário na agenda do Fábio dia 19/12 14h', 'registrar follow-up pra sexta se cliente não responder', 'marcar tag coloração no CRM'>"
  ],
  "reativacao_necessaria": true|false,
  "analise_tempo": {
    "gap_medio_min": ${t.gap_medio_min ?? 'null'},
    "pior_gap_min": ${t.pior_gap_min ?? 'null'},
    "inatividade_atual_min": ${t.inatividade_atual_min ?? 'null'},
    "janela_dominante": "<ex: 'madrugada', 'manhã', 'horário comercial', 'tarde', 'noite', 'fim de semana' ou 'sem padrão' — com base nos horários listados>",
    "comentario": "<1-2 frases: o atendente respondeu rápido ou demorou? o horário bate com o que o cliente usa? isso explica o lead ter esfriado?>"
  },
  "analise": [
    {
      "tone": "success|warning|danger|info",
      "title": "<título curto>",
      "body": "<observação acionável em 1-2 frases sobre essa conversa específica>"
    }
  ],
  "oportunidades_perdidas": [
    "<algo que o atendente já deveria ter feito (responder preço direto, oferecer horário firme, usar oferta da Black Friday, quebrar objeção) — só se houver mesmo>"
  ]
}

REGRAS DURAS (não desobedeça):

1. "nao_comercial" = true quando a mensagem é claramente B2B/parceria/propaganda/spam (ex: palestra, software, parceria institucional, representante comercial). Nesse caso: score_lead ≤ 15, tag_sugerida = "frio", "proxima_resposta" é uma resposta educada de corte/encaminhamento ("Oi, agradecemos o contato. Nosso foco aqui é agendamento de serviços — vou direcionar seu material pro responsável e ele retorna se fizer sentido."), e NÃO entrar em funil comercial.

2. "proxima_resposta" é o entregável principal — texto pronto, sem placeholders, no tom de voz da marca, com próximo passo claro. NUNCA inventar preço, horário, nome de profissional, promoção ou condição que não apareceu LITERALMENTE na transcrição ou no CONTEXTO DA MARCA. Não arredondar, não estimar, não chutar. Se o valor exato não está escrito em nenhum lugar, você NÃO tem esse valor.

3. PREÇO — regra crítica, não desobedeça:
   a) Você só pode citar um valor R$ se ele aparece LITERALMENTE em "OFERTAS" do brain OU em alguma mensagem anterior da transcrição.
   b) Se o cliente perguntou preço e existe valor válido em (a), "proxima_resposta" DEVE começar dando esse valor (não desviar com "qual profissional você prefere?" antes de responder).
   c) Se o cliente perguntou preço e NÃO existe valor válido em (a) — por exemplo, pediu "a partir de quanto" sem o brain trazer esse valor específico — a "proxima_resposta" NÃO chuta número. Em vez disso, oferece 1 de 3 caminhos: (i) cita o valor que existe (ex: combo da BF) e pergunta se é o que faz sentido; (ii) pede info curta pra poder confirmar o valor com precisão ("me confirma qual profissional e o comprimento do seu cabelo que eu te passo o valor exato agora"); (iii) chama pra uma avaliação presencial sem compromisso. Em nenhuma hipótese escreva um número que você não viu literalmente.
   d) Se o cliente perguntou preço 2+ vezes e o atendente seguiu desviando sem responder, isso vira "oportunidades_perdidas" e um item "danger" em "analise".

4. CATÁLOGO/LINK: se o atendente já mandou link do catálogo e o cliente ou não respondeu ou perguntou de novo, NÃO sugerir remandar o mesmo link. Alternativas: foto/exemplo de trabalho do profissional, caso real, resposta direta de valor, convite pra visita presencial, pergunta qualificadora curta.

5. SINAL DE AGENDA: se o cliente perguntou horário/disponibilidade ("tem agenda?", "tem horário dia X?", "tá aberto?"), "proxima_resposta" DEVE propor 2 horários concretos (se a conversa já menciona algum) ou pedir 2 opções do cliente ("manhã ou tarde? quais dias da semana funcionam?"). Nunca responder só "temos sim" sem CTA firme.

6. REATIVAÇÃO: "reativacao_necessaria" = true quando: lead frio (>24h sem interação), OU atendente sumiu (cliente mandou por último e passou >2h), OU o pior gap foi grande o suficiente pra ter esfriado o cliente (>3h) e desde então o lead não voltou. Quando true, "proxima_resposta" DEVE reconhecer brevemente o tempo que passou (sem se desculpar demais), trazer um gancho novo (pergunta curta, lembrete do que o cliente queria, novidade real das OFERTAS), e terminar com CTA pra retomar. Nunca "oi, tudo bem?" isolado.

7. OFERTAS: se o brain menciona uma oferta ativa (ex: Black Friday em dia X) e o cliente está morno, use isso como gancho de urgência REAL. Se a oferta já venceu ou não cabe no perfil, não force.

8. CLIENTE RECORRENTE (ver CRM): se "cliente_recorrente" = true, NÃO use script de primeira apresentação. Trate como cliente conhecido — cumprimento mais próximo, referencie serviço passado se relevante, vá direto no ponto.

9. "analise" INCLUA SEMPRE pelo menos 1 item sobre tempo/horário quando os gaps forem relevantes: tone "warning" ou "danger" se gap médio > 60 min ou pior gap > 3h; "success" se o time respondeu consistentemente em <30 min. Se houver sinal_de_compra forte com resposta fraca do atendente (resposta monossílaba como "sm", "ok", "sim" sem CTA, 1-3 palavras sem próximo passo), criar item "danger" explicitando — ex: "cliente perguntou se tem agenda em dezembro e recebeu 'Estamos sm' — resposta fria num sinal quente, risco alto de esfriar".

10. "oportunidades_perdidas" só lista o que realmente foi perdido — array vazio se o atendente está mandando bem. Exemplos bons: "cliente pediu preço 2 vezes, nunca recebeu", "cliente sinalizou horário em dezembro, atendente não confirmou agenda", "oferta de BF estava ativa e não foi mencionada pra um lead de mechas".

11. "janela_dominante" deve refletir os horários listados — não inventar.

12. tag_sugerida: "quente" se o cliente já demonstrou intenção forte (pediu preço, horário, aceitou valor); "morno" se está pesquisando/comparando; "frio" se só conversou genericamente e sumiu.

13. 2 a 4 itens em "analise". 1 a 3 itens em "proximos_passos". 0 a 4 em "sinais_de_compra", "objecoes_abertas" e "oportunidades_perdidas".

13b. OBRIGATÓRIO retornar TODOS os campos do schema em TODA resposta, mesmo que como array vazio ou string vazia. Em particular: "score_lead" (sempre um inteiro), "primeiro_nome" (string, possivelmente ""), "sinais_de_compra" (array, possivelmente []), "objecoes_abertas" (array), "proximos_passos" (array, 1-3 itens — nunca vazio quando há conversa real), "nao_comercial" (boolean). Não omita nenhum deles.

16. GEOGRAFIA/LOGÍSTICA: se o cliente mencionou que mora em outra cidade/estado, sinalizou distância ("sou de X", "moro em X", "venho de X"), ou declarou horário/data impossível ("não dá pra mim", "trabalho nesse dia"), NÃO force agenda/visita como se a barreira não existisse. Reconheça a barreira primeiro. Caminhos válidos: (a) qualificar se a pessoa consegue vir mesmo assim ("você vem a BH com alguma frequência?"); (b) guardar como referência futura ("quando estiver em BH, me avisa"); (c) sugerir indicação ou consultoria à distância se existir no brain. NUNCA ofertar "agende sua visita" cego quando o cliente acabou de dizer que não consegue.

17. QUALIFICAÇÃO ANTES DE OFERTA (lead novo): se a conversa tem ≤4 mensagens no total E o atendente ainda não perguntou "qual resultado você procura / qual sua expectativa / o que gostaria de transformar", a proxima_resposta DEVE qualificar primeiro (perguntar sobre resultado desejado / referência / situação atual do cabelo). NÃO empurrar oferta/combo/preço antes dessa qualificação, mesmo que o cliente seja quente. O funil da marca é consultivo: entender primeiro, ofertar depois.

17b. Nessa fase de qualificação pura, a proxima_resposta NÃO menciona oferta, combo, Black Friday ou preço em NENHUM lugar da mesma mensagem — nem no começo, nem no meio, nem no final. É só pergunta aberta sobre o resultado desejado. A oferta vai no próximo ping, depois da resposta do cliente. Juntar qualificação + oferta na mesma mensagem queima o funil consultivo.

18. REATIVAÇÃO FORTE (lead frio ou atendente sumiu há >24h): a proxima_resposta DEVE começar reconhecendo explicitamente o tempo que passou. Exemplos bons de abertura: "Oi Fran, voltando aqui com você...", "Oi, retomando nosso papo", "Oi, passando pra ver se você ainda tem interesse". Exemplos ERRADOS (nunca usar quando é reativação): "Que ótimo ter você por aqui!", "Que ótimo receber seu contato!", "Olá, tudo bem?". Essas aberturas soam como primeira interação de hoje e NÃO combinam com conversa de dias atrás. Essa regra vale mesmo quando a 17b (qualificação pura) também se aplica — nesse caso, a abertura é "Oi, voltando aqui" + pergunta aberta de qualificação, SEM oferta. A regra 18 ganha a abertura; a 17b restringe o conteúdo.

19. PROFISSIONAL CERTO: só mencione o nome de um profissional (Fábio Oliver, Rafael Martuchello, Wislan Cristian, Italo Ribeiro, Brenda, etc.) se ele apareceu LITERALMENTE na transcrição da conversa como foco atual — ou seja, o cliente disse o nome, OU o atendente propôs e o cliente aceitou, OU é o profissional confirmado num agendamento já fechado. Em "proximos_passos" e "proxima_resposta", use o profissional CORRETO da conversa. Se a thread fala claramente da Brenda, não escreva "agenda do Fábio". Se não há profissional definido ainda, use "o profissional" ou "a equipe" genericamente.

20. CLIENTE JÁ DECLAROU "NÃO" (perdida / decidiu outra coisa): se o cliente explicitamente fechou com outro ("agendei em outro lugar", "comprei em outro salão", "já resolvi", "não é mais pra mim", "mudei de ideia"), a proxima_resposta NÃO empurra nova oferta, combo ou urgência. O tom é de respeito e porta aberta: agradecer o retorno, desejar um bom atendimento, deixar claro que a casa fica à disposição numa próxima. Nunca fazer "voltando aqui, temos oferta de BF" logo depois de um não — isso vira insistência e queima a marca. Reativacao_necessaria = false nesse caso (não é lead ativo). proximos_passos: 1 item só, normalmente "guardar como referência futura" ou "registrar follow-up pra daqui 60-90 dias".

14. Tudo em português brasileiro, direto, sem floreios.

15. Se a conversa estiver vazia ou só com 1 mensagem do cliente: score_lead = 50, "proxima_resposta" é a abertura ideal pra esse tipo de lead e "reativacao_necessaria" = false.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY não configurada.' }, 400)
  }

  try {
    const { thread, msgs, brain, crm_contexto } = await req.json()
    if (!thread || !Array.isArray(msgs)) {
      return json({ error: 'payload precisa de thread e msgs[]' }, 400)
    }
    const prompt = buildPrompt(thread, msgs, brain || {}, crm_contexto)

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
          { role: 'system', content: 'Você é um coach de vendas sênior em WhatsApp Business de serviços premium. Afiado, direto, comercial. Responda sempre em JSON válido, sem markdown.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return json({ error: `OpenAI ${res.status}: ${data.error?.message || 'erro'}` }, 502)
    }

    const text = data.choices?.[0]?.message?.content || '{}'
    const analysis = JSON.parse(text)
    analysis.gerado_em = new Date().toISOString()
    return json(analysis)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
