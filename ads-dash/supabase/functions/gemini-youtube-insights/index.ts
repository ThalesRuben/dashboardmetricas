// Supabase Edge Function — gemini-youtube-insights
//
// Gera insights estratégicos para um canal do YouTube inteiro, usando
// a API do Google Gemini com o contexto da diretriz de marketing.
//
// Mesmo padrão de gemini-instagram-insights — recebe { yt, brain } e
// devolve { resumo, insights, hipoteses, plano_7d, alertas }.
//
// Deploy:
//   supabase functions deploy gemini-youtube-insights --no-verify-jwt
//
// Uso (no app):
//   supabase.functions.invoke('gemini-youtube-insights', { body: { yt, brain } })

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
    titulo: String(v.titulo || '').slice(0, 140),
    publicado_em: v.publicado_em,
    duracao_seg: v.duracao_seg,
    visualizacoes: v.visualizacoes,
    curtidas: v.curtidas,
    comentarios: v.comentarios,
    retencao_media: v.retencao_media,
  }))
}

function buildPrompt(yt: Record<string, any>, brain: Record<string, string>) {
  const channel = yt?.channel || {}
  const videos = summarizeVideos(yt?.videos || [])

  return `Você é o estrategista de YouTube da marca. Contexto fixo:

NORTE: ${brain?.norte ?? '-'}
PÚBLICO: ${brain?.publico_alvo ?? '-'}
TOM DE VOZ: ${brain?.tom_de_voz ?? '-'}
OFERTAS: ${brain?.ofertas_atuais ?? '-'}
DIFERENCIAIS: ${brain?.diferenciais ?? '-'}
EVITAR: ${brain?.evitar ?? '-'}
PALAVRAS-CHAVE: ${brain?.palavras_chave ?? '-'}

SNAPSHOT DO CANAL:
- Nome: ${channel.channel_name}
- Inscritos: ${channel.inscritos} (variação 30d: ${channel.inscritos_delta_30d})
- Visualizações/dia: ${channel.visualizacoes_dia}
- Horas assistidas: ${channel.horas_assistidas}
- Engajamento médio: ${channel.engajamento_taxa}%
- Total de vídeos: ${channel.total_videos}

ÚLTIMOS VÍDEOS (resumo):
${JSON.stringify(videos, null, 2)}

Analise o canal como um todo. Considere fatores que importam no YouTube:
- Retenção média (>50% é alvo; <30% mata alcance)
- Thumbnails e títulos como gargalo de CTR
- Mix entre Shorts (<= 60s) e vídeos longos
- Sequências/playlists pra subir tempo de sessão
- Frequência (1 longo/semana + Shorts é o mínimo saudável)

Responda SOMENTE com JSON válido (sem markdown) neste formato:
{
  "modelo": "gemini-2.0-flash",
  "resumo": "<2-3 frases sobre o estado geral do canal>",
  "insights": [
    { "tone": "success|warning|danger|info", "title": "<curto>", "body": "<1-2 frases acionáveis>" }
  ],
  "hipoteses": [ "<hipótese baseada nos dados>" ],
  "plano_7d": [
    { "dia": "Segunda", "formato": "Vídeo longo|Short|Live|Tutorial", "tema": "<tema>", "gancho": "<promessa do título + hook de 15s>" }
  ],
  "alertas": [ "<alerta crítico — array vazio se nada urgente>" ]
}

Regras:
- 4-6 insights priorizando os mais impactantes
- Plano de 7 dias com 2-4 conteúdos (YouTube é menos frequente)
- Inclua pelo menos 1 sugestão de Short e 1 de vídeo longo
- Tudo em português brasileiro, tom direto`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (!GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY não configurada — usando fallback local.' }, 400)
  }

  try {
    const { yt, brain } = await req.json()
    if (!yt?.channel) return json({ error: 'payload precisa de yt.channel e yt.videos' }, 400)
    const prompt = buildPrompt(yt, brain || {})

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
