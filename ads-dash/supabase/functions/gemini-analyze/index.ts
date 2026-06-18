// Supabase Edge Function — gemini-analyze
//
// Analisa por que um vídeo viralizou e gera copy/roteiro adaptados,
// usando a API do Google Gemini com o contexto da diretriz de marketing.
//
// Variáveis de ambiente (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY   chave da API do Google AI Studio (https://aistudio.google.com/apikey)
//
// Deploy:
//   supabase functions deploy gemini-analyze --no-verify-jwt
//
// Uso (no app):
//   supabase.functions.invoke('gemini-analyze', { body: { video, brain } })
//
// Se a chave não estiver configurada, a função responde 400 e o app cai
// automaticamente para o motor de regras local (src/lib/viralAnalysis.js).

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const MODEL = 'gemini-2.0-flash'

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

Responda SOMENTE com um JSON válido (sem markdown) neste formato exato:
{
  "modelo": "gemini-2.0-flash",
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

  if (!GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY não configurada — usando fallback local.' }, 400)
  }

  try {
    const { video, brain } = await req.json()
    const prompt = buildPrompt(video || {}, brain || {})

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, responseMimeType: 'application/json' },
        }),
      },
    )

    const data = await res.json()
    if (!res.ok) {
      return json({ error: `Gemini ${res.status}: ${data.error?.message || 'erro'}` }, 502)
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const analysis = JSON.parse(text)
    analysis.gerado_em = new Date().toISOString()
    return json(analysis)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})
