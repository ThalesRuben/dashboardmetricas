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
//   ANTHROPIC_API_KEY
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

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY  = Deno.env.get('ANTHROPIC_API_KEY')!
const CRON_SECRET    = Deno.env.get('COACH_CRON_SECRET')

const TENANT_DEFAULT = '31cc6350-d721-477d-bac6-3d5d8c907582'  // the-blonde-concept
const MODEL = 'claude-sonnet-4-6'
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

interface ProfissionalSugerido {
  nome: string
  tier?: 'fabio' | 'intermediario' | 'equipe'
  combo_valor?: string
  motivo?: string
}

interface ObjecaoDetectada {
  // tipo pré-classificado pra UI filtrar / badge colorir.
  tipo: 'preco' | 'agenda' | 'logistica' | 'tecnica' | 'indecisao' | 'concorrencia' | 'nenhuma'
  // trecho real da conversa (frase do cliente) que motivou a classificação.
  trecho: string
  // 1 frase de como a proxima_resposta ataca essa objeção — serve de auditoria.
  tratamento: string
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
  objecao_detectada?: ObjecaoDetectada
  profissionais_sugeridos?: ProfissionalSugerido[]
}

// ---- cópia enxuta do prompt do coach (SÓ as partes que importam pra
// reativação). Replica regra 16/17/18/20. ----
//
// Dividido em 2 pedaços pra aproveitar o prompt caching do Claude: a parte
// FIXA (regras + brain + equipe + schema) vai pro bloco `system` com
// cache_control; a parte VARIÁVEL (contato + transcrição) vai no `messages`.

function buildSystemPrompt(brain: Record<string, string>): string {
  return `Você é um coach de vendas sênior em WhatsApp Business de salão premium. Analise a conversa dormente abaixo e gere uma mensagem de REATIVAÇÃO afiada, no tom da marca, pronta pra enviar.

CONTEXTO DA MARCA:
NORTE: ${brain?.norte ?? '-'}
PÚBLICO: ${brain?.publico_alvo ?? '-'}
TOM DE VOZ: ${brain?.tom_de_voz ?? '-'}
OFERTAS: ${brain?.ofertas_atuais ?? '-'}
DIFERENCIAIS: ${brain?.diferenciais ?? '-'}
EVITAR: ${brain?.evitar ?? '-'}
PALAVRAS-CHAVE: ${brain?.palavras_chave ?? '-'}

EQUIPE E PREÇOS (fonte única de nomes e valores — você só pode citar o que está aqui):
${brain?.equipe ?? '(equipe não cadastrada — não citar nome de profissional)'}

PLAYBOOK COMERCIAL — frameworks destilados dos maiores experts em vendas. A mensagem de reativação DEVE aplicar explicitamente pelo menos UMA técnica listada abaixo. Prefira combinar 2-3. Regra zero: a cliente precisa SENTIR que foi entendida antes de qualquer pitch.

[1] TACTICAL EMPATHY (Chris Voss, "Never Split the Difference")
- Nomeie a emoção ANTES de vender: "Imagino que o combo pareceu investimento alto numa primeira olhada" / "Sei que escolher o loiro ideal dá um frio na barriga"
- Mirrors: ecoe 2-3 palavras-chave que a cliente usou na conversa como gatilho de memória
- NUNCA "por quê?" — use "como?" / "o quê?" (pergunta aberta sem defensiva)
- Accusation audit: antecipe a objeção dela e desarma antes ("Sei que já faz tempo que a gente não conversa...")

[2] SPIN SELLING (Neil Rackham)
- Pule direto pra Need-payoff: faça a cliente IMAGINAR o resultado final ("Se saísse igual à referência de primeira, como seria sua rotina com o cabelo?")
- Em reativação não dá pra entediar com Situação — já conhece a dor dela, amplifique a IMPLICAÇÃO

[3] INFLUÊNCIA (Robert Cialdini, "Influence")
- RECIPROCIDADE: entregue valor na própria reativação (dica, insight sobre o cabelo dela, oferta curada pra ela especificamente)
- PROVA SOCIAL com perfil ("outra cliente que também estava decidindo entre combo e só mechas fechou com a Paula e postou resultado") — nunca genérico
- ESCASSEZ apenas se REAL ("abriu um horário com Juliana na ter 14h — é o único dessa semana") — nunca fabricar
- AUTORIDADE concreta (número, método, resultado específico) — não adjetivo vago
- COMPROMISSO PROGRESSIVO: peça micro-sim antes do macro ("topa eu te mandar uma referência pra ver se tá alinhada com o que você quer?")

[4] STATUS E FRAME CONTROL (Oren Klaff, "Pitch Anything")
- Você é a curadoria escassa, não a suplicante
- "Separei isso pensando em você antes de abrir pra outras clientes" > "Me responde por favor"
- Eleve o resultado, nunca reduza o valor
- Reativação suplicante repele; reativação confiante converte

[5] OBJEÇÕES (Jeb Blount, "Objections")
- Identifique a objeção não-resolvida pela transcrição e enfrente DIRETO na reativação
- Se a objeção foi PREÇO: ofereça tier inferior do MESMO SERVIÇO, com a mesma qualidade de resultado
- Se foi MACRO (medo): prova social + descrição de como o método reduz risco
- Se foi SMOKESCREEN: use a reativação pra fazer a objeção real aparecer ("Me conta o que mais passou pela sua cabeça depois que a gente falou?")

[6] FECHAMENTO (Brian Tracy / Grant Cardone)
- Toda reativação DEVE terminar com chamada ASSUMPTIVA + ALTERNATIVA: "Prefere terça ou quinta?" / "Posso reservar com a Paula pra sexta?"
- Nunca "me avisa se tiver interesse" — isso é mortal, perde o frame
- SUMMARY CLOSE pra leads quentes: recap do que ela queria + oferta curada + chamada

[7] RAPPORT (Jeffrey Gitomer, "Sales Bible" / Daniel Pink, "To Sell is Human")
- Mencione detalhe específico da conversa anterior ("você tinha falado que o loiro atual puxa pro amarelado") — mostra que lembrou
- Attunement: adapte o tom à cliente original
- Gitomer: ela quer COMPRAR, não ser vendida — faça a reativação parecer curadoria pessoal, não blast de vendas

[8] CADÊNCIA DE REATIVAÇÃO (Jeb Blount, "Fanatical Prospecting") — ESSA É A MAIS IMPORTANTE PRO CRON
- 80% dos vendedores desistem após 1-2 tentativas. Lead dormente é oportunidade, não constrangimento
- SEMPRE com ÂNGULO NOVO:
  • Nova oferta/vaga genuína ("abriu um horário com Paula sexta, lembrei de você")
  • Insight relevante ("vi essa referência e lembrei do loiro que você queria")
  • Pergunta qualificadora nova ("tá pensando pra alguma data específica? natal?")
  • Prova social recente ("acabei de atender cliente com perfil parecido, resultado foi esse")
- NUNCA: "sumiu, né?" / "tá aí?" / "viu minha mensagem?" / "não vai responder?"
- Se lead está mais de 30 dias dormente: o ângulo é 90% do peso da mensagem. Sem ângulo novo, a reativação vira spam

REGRA META: Antes de escrever proxima_resposta, decida mentalmente qual técnica vai aplicar. Se a mensagem não aplica nenhuma, está fraca — reescreva.

FORMATO DA SAÍDA — responda SOMENTE com um objeto JSON válido começando com { e terminando com }. Sem markdown, sem comentários, sem texto antes ou depois. Schema:
{
  "score_lead": <inteiro 0-100>,
  "tag_sugerida": "quente|morno|frio",
  "nao_comercial": true|false,
  "ja_resolvido": true|false,
  "motivo_ja_resolvido": "<string curta quando ja_resolvido=true, senão vazio>",
  "primeiro_nome": "<ou string vazia>",
  "resumo": "<1 frase sobre o estado da conversa>",
  "objecao_detectada": {
    "tipo": "preco | agenda | logistica | tecnica | indecisao | concorrencia | nenhuma",
    "trecho": "<citação literal do cliente que revela a objeção — ex: 'tá caro', 'não consigo nesse dia', 'moro em SP'. Vazio quando tipo=nenhuma.>",
    "tratamento": "<em 1 frase, como a proxima_resposta ataca essa objeção — ex: 'oferece Thais do tier equipe a R$ 1.097 pra endereçar o preço do Fábio'. Vazio quando tipo=nenhuma.>"
  },
  "profissionais_sugeridos": [
    {
      "nome": "<nome EXATO da EQUIPE E PREÇOS>",
      "tier": "fabio | intermediario | equipe",
      "combo_valor": "<faixa EXATA do combo desse profissional lida da EQUIPE — ex: 'R$ 1.097 / 1.247 / 1.397'. Vazio se não é combo de mechas.>",
      "motivo": "<em 1 frase, por que esse profissional casa com esta cliente — citando sinal concreto da conversa>"
    }
  ],
  "proxima_resposta": "<mensagem PRONTA de reativação, 1-3 frases, em pt-BR, tom da marca, que ATACA a objecao_detectada>",
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

10. proxima_resposta: 1-3 frases, direto, tom acolhedor, sem floreios, sem desculpar demais. Se ja_resolvido=true, string vazia.

11. OBJEÇÃO — leia a transcrição inteira e identifique o motivo real do lead ter esfriado. Classifique em um dos tipos:
   - "preco": cliente REAGIU negativamente a um valor já informado — achou caro, comparou com concorrente, pediu desconto, sumiu DEPOIS do preço ter sido enviado. Apenas PERGUNTAR valor ("qual o valor?", "quanto fica?", "quero saber o preço", "preciso saber o valor") NÃO é objeção de preço — é só pedir informação. Nesse caso use "nenhuma" e a proxima_resposta DEVE RESPONDER o valor do serviço que ela perguntou (ler da EQUIPE).
   - "agenda": cliente queria dia/horário específico que não encaixou, atendente demorou pra confirmar, agenda não tinha vaga.
   - "logistica": cliente de outra cidade/estado, mencionou distância, declarou que não consegue vir.
   - "tecnica": cliente perguntou algo específico (procedimento, duração, cuidado) e não recebeu resposta clara.
   - "indecisao": cliente ficou de "ver com o marido/mãe", "pensar", "retornar depois" sem motivo concreto.
   - "concorrencia": cliente mencionou outro salão/profissional em comparação.
   - "nenhuma": não dá pra classificar com confiança (sumiu sem sinal claro) OU cliente só pediu informação e não houve reação negativa ainda.
   Se tipo != "nenhuma", "trecho" cita literalmente uma frase do cliente que revela essa objeção, e "tratamento" descreve em 1 frase como a proxima_resposta vai atacar.

12. proxima_resposta DEVE atacar a objecao_detectada frontalmente (quando tipo != "nenhuma"):
   - preco → oferecer profissional de tier INFERIOR da EQUIPE com valor exato DO MESMO SERVIÇO que a cliente queria. Se a conversa é sobre corte, use valor de CORTE do tier inferior (ex: Rafael R$ 390, Jonne R$ 360, tier equipe R$ 345). Se é combo de mechas, use combo_valor. Se é coloração, use preço de coloração. NÃO empurre combo de mechas quando a cliente estava falando de corte. JAMAIS inventar desconto ou condição.
   - agenda → propor 2 horários/dias concretos OU pedir 2 opções da cliente. Se agenda do profissional original não encaixa, oferecer outro da EQUIPE.
   - logistica → reconhecer a barreira primeiro, oferecer alternativa consultiva (consultoria à distância se existir, "quando estiver em BH, me avisa").
   - tecnica → responder DIRETO a dúvida técnica com base em OFERTAS/DIFERENCIAIS/EQUIPE do brain; não mandar "me manda uma foto" como fuga.
   - indecisao → trazer gancho novo e CTA curto ("alguma novidade por aí? consegue me passar a decisão até sexta pra eu reservar o horário?").
   - concorrencia → não brigar com o concorrente, reforçar diferencial ("nosso método é X, treinamento com Fábio Oliver, resultado Y").
   - nenhuma → reativação clássica: reconhecer o tempo + gancho + CTA.

13. profissionais_sugeridos:
   - Se objecao_detectada.tipo == "preco" → 1 ou 2 opções de TIER INFERIOR ao profissional já envolvido na conversa (lido da EQUIPE).
   - Se tipo == "agenda" → opções alternativas de profissional.
   - Se cliente pediu literal "outros profissionais" ou "qual outro" → 2-3 opções diferentes do que ele já conhece.
   - Se cliente tem perfil claro (cacheado → Brenda; mega hair → Jonne) → 1 opção direta.
   - Se cliente SÓ PERGUNTOU o valor (tipo="nenhuma") e ainda não houve objeção → array vazio []. Nesse caso a proxima_resposta só informa o valor do serviço discutido, sem empurrar alternativa.
   - Caso contrário → array vazio [].
   - combo_valor TEM QUE SER DO MESMO SERVIÇO que a cliente está discutindo. Se é corte → preço de corte do profissional (ex: "R$ 390", "R$ 345"). Se é combo de mechas → combo_valor completo (ex: "R$ 1.097 / 1.247 / 1.397"). Se é coloração → valor da coloração. NUNCA retornar combo de mechas quando o assunto é corte.
   - NUNCA inventar nome/preço. Usa a EQUIPE literalmente. O nome em "proxima_resposta" deve bater com os sugeridos.
   - "nossa equipe treinada pelo Fábio pelo método The Blonde Concept" (ou variação natural) é a frase-âncora quando sugerir alguém diferente do que o cliente já conhecia.

14. Se ja_resolvido=true OU reativacao_necessaria=false OU nao_comercial=true: objecao_detectada.tipo="nenhuma", profissionais_sugeridos=[], e proxima_resposta="".`
}

function buildUserPrompt(thread: Candidata, msgs: MsgReal[]): string {
  const recentes = msgs.slice(-60)
  const transcricao = recentes
    .map((m) => `[${new Date(m.hora).toLocaleString('pt-BR')}] ${m.autor === 'cliente' ? 'CLIENTE' : 'ATENDENTE'}: ${m.texto}`)
    .join('\n')
  const nome = thread.contato_nome || thread.contato_phone

  return `CONTATO: ${nome} (${thread.contato_phone}) · status: ${thread.status}

TRANSCRIÇÃO COMPLETA (mais antigas em cima):
${transcricao || '(sem mensagens)'}

Agora responda SOMENTE com o JSON pedido no FORMATO DA SAÍDA — começa com { e termina com }.`
}

// Extrai o primeiro bloco JSON balanceado do texto (respeita strings e escapes).
// Robusto a modelos que ocasionalmente adicionam preâmbulo apesar da instrução.
function extractJson(text: string): any | null {
  const first = text.indexOf('{')
  if (first < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = first; i < text.length; i++) {
    const c = text[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(text.slice(first, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

async function chamarCoach(thread: Candidata, msgs: MsgReal[], brain: Record<string, string>): Promise<CoachResult | null> {
  const systemPrompt = buildSystemPrompt(brain)
  const userPrompt   = buildUserPrompt(thread, msgs)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0.4,
        // Prompt caching: system (regras + brain + equipe + schema) cacheia e
        // paga ~10% nos tokens repetidos. Como o cron roda 2x/dia e varre ~50
        // threads por run, ficam ~50 reads batendo no mesmo cache por run.
        system: [
          { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
        ],
        messages: [
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = typeof data?.content?.[0]?.text === 'string' ? data.content[0].text : ''
    return extractJson(text) as CoachResult | null
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

  // 2) Busca candidatas — ordem por mais recentes primeiro (RPC já ordena desc)
  //    min=24h: pega leads que sumiram ontem, decisão rápida
  //    max=7d: não ressuscita conversa antiga (vira retrabalho)
  const { data: candidatas, error: errCand } = await admin.rpc('coach_reativacao_candidatas', {
    p_tenant_id: tenantId,
    p_min_horas: 24,
    p_max_horas: 24 * 7,
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
