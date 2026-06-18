// Supabase Edge Function — gemini-instagram-insights
//
// Gera insights estratégicos para uma conta do Instagram inteira,
// usando a API do Google Gemini com o contexto da diretriz de marketing.
//
// Diferença para gemini-analyze: aquela função analisa um vídeo específico.
// Esta aqui recebe o snapshot da conta (`IgData`) e devolve um plano
// estratégico — hipóteses do que está performando, alertas, plano de
// conteúdo dos próximos 7 dias e ações de curto prazo.
//
// Variáveis de ambiente (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY   chave da API do Google AI Studio
//
// Deploy:
//   supabase functions deploy gemini-instagram-insights --no-verify-jwt
//
// Uso (no app):
//   supabase.functions.invoke('gemini-instagram-insights', { body: { ig, brain } })
//
// Se a chave não estiver configurada, responde 400 e o app cai para o
// motor de regras local (generateInstagramInsights em src/lib/aiInsights.ts).

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

function summarizePosts(posts: Array<Record<string, unknown>>) {
  // O Gemini recebe melhor um resumo do que a lista bruta.
  // Mandamos só os 8 mais recentes + os top 3 por engajamento.
  const recent = [...posts]
    .sort((a, b) => new Date(String(b.publicado_em)).getTime() - new Date(String(a.publicado_em)).getTime())
    .slice(0, 8)
  const top = [...posts]
    .sort((a, b) => Number(b.engajamento_taxa || 0) - Number(a.engajamento_taxa || 0))
    .slice(0, 3)
  const dedupe = new Map<string, Record<string, unknown>>()
  for (const p of [...recent, ...top]) {
    dedupe.set(String(p.id || p.ig_post_id), p)
  }
  return Array.from(dedupe.values()).map(p => ({
    tipo: p.tipo,
    caption: String(p.caption || '').slice(0, 140),
    publicado_em: p.publicado_em,
    engajamento_taxa: p.engajamento_taxa,
    alcance: p.alcance,
    plays: p.plays,
    curtidas: p.curtidas,
    comentarios: p.comentarios,
    salvamentos: p.salvamentos,
    compartilhamentos: p.compartilhamentos,
  }))
}

function buildPrompt(ig: Record<string, any>, brain: Record<string, string>) {
  const account = ig?.account || {}
  const posts = summarizePosts(ig?.posts || [])

  return `Você é o estrategista de Instagram da marca. Contexto fixo:

NORTE: ${brain?.norte ?? '-'}
PÚBLICO: ${brain?.publico_alvo ?? '-'}
TOM DE VOZ: ${brain?.tom_de_voz ?? '-'}
OFERTAS: ${brain?.ofertas_atuais ?? '-'}
DIFERENCIAIS: ${brain?.diferenciais ?? '-'}
EVITAR: ${brain?.evitar ?? '-'}
PALAVRAS-CHAVE: ${brain?.palavras_chave ?? '-'}

SNAPSHOT DA CONTA:
- Handle: ${account.username}
- Seguidores: ${account.seguidores} (variação 30d: ${account.seguidores_delta_30d})
- Engajamento médio: ${account.engajamento_taxa}%
- Alcance dia: ${account.alcance_dia}
- Visitas ao perfil: ${account.visitas_perfil}
- Cliques no site: ${account.cliques_site}

ÚLTIMOS POSTS (resumo):
${JSON.stringify(posts, null, 2)}

Analise a conta como um todo e devolva insights estratégicos acionáveis.
Responda SOMENTE com JSON válido (sem markdown) neste formato:
{
  "modelo": "gemini-2.0-flash",
  "resumo": "<2-3 frases sobre o estado geral da conta>",
  "insights": [
    {
      "tone": "success|warning|danger|info",
      "title": "<título curto>",
      "body": "<recomendação acionável em 1-2 frases>"
    }
  ],
  "hipoteses": [
    "<hipótese sobre o que está performando ou não, com base nos dados>"
  ],
  "plano_7d": [
    { "dia": "Segunda", "formato": "Reel|Carrossel|Story|Foto", "tema": "<tema>", "gancho": "<gancho de abertura>" }
  ],
  "alertas": [
    "<alerta crítico se houver — risco de queda de engajamento, oportunidade urgente, etc.>"
  ]
}

Regras:
- Gere 4-6 insights, priorizando os mais impactantes.
- Plano de 7 dias deve ser realista (não mais de 5 conteúdos na semana).
- Hipóteses devem se basear nos dados (cite números quando útil).
- Alertas só se houver algo realmente crítico — array vazio se tudo ok.
- Tudo em português brasileiro, tom direto, sem floreios.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY não configurada — usando fallback local.' }, 400)
  }

  try {
    const { ig, brain } = await req.json()
    if (!ig?.account) {
      return json({ error: 'payload precisa de ig.account e ig.posts' }, 400)
    }
    const prompt = buildPrompt(ig, brain || {})

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
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
