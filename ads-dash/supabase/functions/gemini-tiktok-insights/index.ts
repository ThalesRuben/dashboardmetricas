// Supabase Edge Function — gemini-tiktok-insights
//
// Gera insights estratégicos para uma conta do TikTok inteira, usando
// a API do Google Gemini com o contexto da diretriz de marketing.
//
// Mesmo padrão de gemini-instagram-insights — recebe { tt, brain } e
// devolve { resumo, insights, hipoteses, plano_7d, alertas }.
//
// Deploy:
//   supabase functions deploy gemini-tiktok-insights --no-verify-jwt
//
// Uso (no app):
//   supabase.functions.invoke('gemini-tiktok-insights', { body: { tt, brain } })

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

function summarizeVideos(videos: Array<Record<string, unknown>>) {
  const recent = [...videos]
    .sort((a, b) => new Date(String(b.publicado_em)).getTime() - new Date(String(a.publicado_em)).getTime())
    .slice(0, 8)
  const top = [...videos]
    .sort((a, b) => Number(b.visualizacoes || 0) - Number(a.visualizacoes || 0))
    .slice(0, 3)
  const dedupe = new Map<string, Record<string, unknown>>()
  for (const v of [...recent, ...top]) dedupe.set(String(v.id), v)
  return Array.from(dedupe.values()).map(v => ({
    caption: String(v.caption || '').slice(0, 140),
    publicado_em: v.publicado_em,
    visualizacoes: v.visualizacoes,
    curtidas: v.curtidas,
    comentarios: v.comentarios,
    compartilhamentos: v.compartilhamentos,
    engajamento_taxa: v.engajamento_taxa,
  }))
}

function buildPrompt(tt: Record<string, any>, brain: Record<string, string>) {
  const account = tt?.account || {}
  const videos = summarizeVideos(tt?.videos || [])

  return `Você é o estrategista de TikTok da marca. Contexto fixo:

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
- Curtidas totais: ${account.curtidas_total}
- Engajamento médio: ${account.engajamento_taxa}%
- Visualizações/dia: ${account.visualizacoes_dia}
- Total de vídeos publicados: ${account.total_videos}

ÚLTIMOS VÍDEOS (resumo):
${JSON.stringify(videos, null, 2)}

Analise a conta como um todo no contexto de TikTok orgânico. Considere:
- Frequência de postagem (TikTok exige 1+/dia)
- Hooks dos primeiros 2 segundos (decisivos no algoritmo)
- Áudios em tendência
- Mix entre vídeos rápidos e mais longos
- Conversão de seguidores em tráfego para outras plataformas

Responda SOMENTE com JSON válido (sem markdown) neste formato:
{
  "modelo": "gemini-2.0-flash",
  "resumo": "<2-3 frases sobre o estado geral da conta>",
  "insights": [
    { "tone": "success|warning|danger|info", "title": "<curto>", "body": "<1-2 frases acionáveis>" }
  ],
  "hipoteses": [ "<hipótese baseada nos dados>" ],
  "plano_7d": [
    { "dia": "Segunda", "formato": "Vídeo curto|Vídeo longo|Trend|Bastidor", "tema": "<tema>", "gancho": "<gancho dos 2 primeiros segundos>" }
  ],
  "alertas": [ "<alerta crítico — array vazio se nada urgente>" ]
}

Regras:
- 4-6 insights priorizando os mais impactantes
- Plano de 7 dias com 5-6 conteúdos (TikTok pede volume)
- Tudo em português brasileiro, tom direto`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY não configurada — usando fallback local.' }, 400)
  }

  try {
    const { tt, brain } = await req.json()
    if (!tt?.account) return json({ error: 'payload precisa de tt.account e tt.videos' }, 400)
    const prompt = buildPrompt(tt, brain || {})

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
    if (!res.ok) return json({ error: `Gemini ${res.status}: ${data.error?.message || 'erro'}` }, 502)

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const analysis = JSON.parse(text)
    analysis.gerado_em = new Date().toISOString()
    return json(analysis)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
