// Supabase Edge Function — gemini-youtube-insights
//
// [NOME MANTIDO POR COMPATIBILIDADE COM O FRONT — provider é OpenAI]
//
// Gera insights estratégicos para um canal do YouTube inteiro, usando
// a API da OpenAI (gpt-4o-mini) com o contexto da diretriz de marketing.
//
// Mesmo padrão de gemini-instagram-insights — recebe { yt, brain } e
// devolve { resumo, insights, hipoteses, plano_7d, alertas }.
//
// Deploy:
//   supabase functions deploy gemini-youtube-insights --no-verify-jwt
//
// Uso (no app):
//   supabase.functions.invoke('gemini-youtube-insights', { body: { yt, brain } })

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

Responda SOMENTE com um objeto JSON válido (sem markdown, sem \`\`\`) neste formato:
{
  "modelo": "${MODEL}",
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

  if (!OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY não configurada — usando fallback local.' }, 400)
  }

  try {
    const { yt, brain } = await req.json()
    if (!yt?.channel) return json({ error: 'payload precisa de yt.channel e yt.videos' }, 400)
    const prompt = buildPrompt(yt, brain || {})

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Você é um estrategista de YouTube para pequenos negócios brasileiros. Responda sempre em JSON válido, sem markdown.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const data = await res.json()
    if (!res.ok) return json({ error: `OpenAI ${res.status}: ${data.error?.message || 'erro'}` }, 502)

    const text = data.choices?.[0]?.message?.content || '{}'
    const analysis = JSON.parse(text)
    analysis.gerado_em = new Date().toISOString()
    return json(analysis)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
