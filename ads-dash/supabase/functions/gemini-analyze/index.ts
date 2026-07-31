// Supabase Edge Function — gemini-analyze
//
// [NOME MANTIDO POR COMPATIBILIDADE COM O FRONT — provider é OpenAI]
//
// Analisa por que um vídeo viralizou e gera copy/roteiro adaptados,
// usando a API da OpenAI (gpt-4o-mini) com o contexto da diretriz de
// marketing.
//
// Variáveis de ambiente (Supabase → Edge Functions → Secrets):
//   OPENAI_API_KEY   chave da API da OpenAI (https://platform.openai.com/api-keys)
//
// Deploy:
//   supabase functions deploy gemini-analyze --no-verify-jwt
//
// Uso (no app):
//   supabase.functions.invoke('gemini-analyze', { body: { video, brain } })
//
// Se a chave não estiver configurada, a função responde 400 e o app cai
// automaticamente para o motor de regras local (src/lib/viralAnalysis.js).

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

function buildPrompt(video: Record<string, unknown>, brain: Record<string, string>) {
  return `Você é o estrategista de marketing da marca. Contexto fixo:

NORTE: ${brain?.norte ?? '-'}
PÚBLICO: ${brain?.publico_alvo ?? '-'}
TOM DE VOZ: ${brain?.tom_de_voz ?? '-'}
OFERTAS: ${brain?.ofertas_atuais ?? '-'}
DIFERENCIAIS: ${brain?.diferenciais ?? '-'}
EVITAR: ${brain?.evitar ?? '-'}
PALAVRAS-CHAVE: ${brain?.palavras_chave ?? '-'}

Analise este vídeo e explique por que ele performou:
${JSON.stringify(video, null, 2)}

Responda SOMENTE com um objeto JSON válido (sem markdown, sem \`\`\`) neste formato exato:
{
  "modelo": "${MODEL}",
  "score": <0-100>,
  "veredito": { "label": "<texto curto>", "tone": "accent|amber|magenta" },
  "fatores": [ { "dimensao": "<nome>", "valor": <0-100>, "nota": "<frase>" } ],
  "porque": [ "<frase>", "<frase>", "<frase>" ],
  "copy": { "ganchos": ["<5 ganchos>"], "legenda": "<legenda completa>", "cta": ["<3 CTAs>"] },
  "roteiro": [ { "tempo": "<faixa>", "acao": "<descrição>" } ]
}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY não configurada — usando fallback local.' }, 400)
  }

  try {
    const { video, brain } = await req.json()
    const prompt = buildPrompt(video || {}, brain || {})

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Você é um analista de conteúdo viral. Responda sempre em JSON válido, sem markdown.' },
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
