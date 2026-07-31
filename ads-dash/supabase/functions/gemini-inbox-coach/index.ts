// Supabase Edge Function — gemini-inbox-coach
//
// [NOME MANTIDO POR COMPATIBILIDADE COM O FRONT — provider é OpenAI]
//
// Recebe uma conversa do WhatsApp (thread + msgs) e devolve sugestões da IA
// pra aumentar conversão: próxima resposta pronta pra colar, análise do
// estado da conversa, oportunidades que o atendente ainda não explorou e
// classificação de temperatura do lead (quente/morno/frio).
//
// Variáveis de ambiente (Supabase → Edge Functions → Secrets):
//   OPENAI_API_KEY   chave da API da OpenAI
//
// Deploy:
//   supabase functions deploy gemini-inbox-coach --no-verify-jwt
//
// Uso (no app):
//   supabase.functions.invoke('gemini-inbox-coach', { body: { thread, msgs, brain } })

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

function buildPrompt(thread: ThreadInput, msgs: MsgInput[], brain: Record<string, string>) {
  // Limita a 60 msgs mais recentes pra não estourar contexto.
  const recentes = msgs.slice(-60)
  const transcricao = recentes
    .map((m) => `[${new Date(m.hora).toLocaleString('pt-BR')}] ${m.autor === 'cliente' ? 'CLIENTE' : 'ATENDENTE'}: ${m.texto}`)
    .join('\n')

  const nome = thread.contato_nome || thread.contato_phone

  return `Você é o coach de vendas da marca. Analisa conversas de WhatsApp pra aumentar a taxa de conversão.

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

TRANSCRIÇÃO (mais antigas em cima):
${transcricao || '(sem mensagens)'}

Sua tarefa: analise o estado da conversa e devolva sugestões acionáveis pra fechar a venda / avançar o lead. Responda SOMENTE com um objeto JSON válido (sem markdown, sem \`\`\`) neste formato:
{
  "modelo": "${MODEL}",
  "resumo": "<1-2 frases sobre o estado da conversa: o que o cliente quer, em que ponto travou>",
  "tag_sugerida": "quente|morno|frio",
  "proxima_resposta": "<mensagem PRONTA pra colar e enviar pelo WhatsApp. Curta (1-3 frases), em pt-BR, tom da marca, com CTA claro. Use o primeiro nome se disponível.>",
  "analise": [
    {
      "tone": "success|warning|danger|info",
      "title": "<título curto>",
      "body": "<observação acionável em 1-2 frases sobre essa conversa específica>"
    }
  ],
  "oportunidades_perdidas": [
    "<algo que o atendente já deveria ter feito (oferecer agendamento, mandar preço, quebrar objeção, etc.) — só se houver mesmo>"
  ]
}

Regras:
- "proxima_resposta" é o entregável principal — texto pronto, sem placeholders, no tom de voz da marca, com próximo passo claro (agendar, mandar localização, confirmar horário, mandar preço, etc.). NUNCA inventar preço/horário que não apareceu na conversa.
- tag_sugerida: "quente" se o cliente já demonstrou intenção forte (pediu preço, horário, agendou); "morno" se está pesquisando; "frio" se só conversou e sumiu.
- 2 a 4 itens em "analise". Prioriza sinais de compra perdidos, objeções não tratadas, tempo de resposta longo.
- "oportunidades_perdidas" só lista o que realmente foi perdido — array vazio se o atendente está mandando bem.
- Tudo em português brasileiro, direto, sem floreios.
- Se a conversa estiver vazia ou só com 1 mensagem do cliente, a "proxima_resposta" é a abertura ideal pra esse tipo de lead.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY não configurada.' }, 400)
  }

  try {
    const { thread, msgs, brain } = await req.json()
    if (!thread || !Array.isArray(msgs)) {
      return json({ error: 'payload precisa de thread e msgs[]' }, 400)
    }
    const prompt = buildPrompt(thread, msgs, brain || {})

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Você é um coach de vendas experiente em WhatsApp Business. Responda sempre em JSON válido, sem markdown.' },
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
