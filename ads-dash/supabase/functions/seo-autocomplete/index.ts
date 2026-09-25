// Supabase Edge Function — seo-autocomplete
//
// Proxy pra Google Autocomplete (público, sem key, sem custo).
// Retorna um SeoKeywordResearch com:
//   * ideias   → sugestões reais do Google Autocomplete
//   * perguntas → autocomplete com prefixos "como/quanto/qual/onde"
//   * volume/dificuldade/cpc/tendencia → hash determinístico (mock declarado)
//   * intent   → heurística por palavras-chave
//
// Motivo do proxy: Google Autocomplete tem restrição de CORS quando chamado
// direto do browser. Rodar aqui contorna e dá pra cachear na tabela
// seo_research_history do repo Supabase.
//
// Chamado pelo front via supabase.functions.invoke('seo-autocomplete', { body: { termo } }).
// Deploy:
//   supabase functions deploy seo-autocomplete --no-verify-jwt

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Dificuldade = 'baixa' | 'média' | 'alta'
type Intent = 'informacional' | 'comercial' | 'transacional' | 'navegacional' | 'local'

interface KeywordIdea {
  termo: string
  volume: number
  dificuldade: Dificuldade
  intent: Intent
}

interface KeywordResearch {
  termo: string
  volume: number
  dificuldade: Dificuldade
  cpc: number
  intent: Intent
  tendencia: number
  ideias: KeywordIdea[]
  perguntas: string[]
  source: 'google-autocomplete+mock'   // sinaliza pra UI que é híbrido
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const termo = String(body.termo ?? '').trim().toLowerCase()
    if (!termo) return json({ error: 'termo obrigatório' }, 400)

    const [ideias, perguntas] = await Promise.all([
      fetchIdeias(termo).catch(() => []),
      fetchPerguntas(termo).catch(() => []),
    ])

    const research: KeywordResearch = {
      termo,
      volume:      mockVolume(termo),
      dificuldade: mockDifficulty(termo),
      cpc:         mockCPC(termo),
      intent:      heuristicIntent(termo),
      tendencia:   mockTrend(termo),
      ideias,
      perguntas,
      source: 'google-autocomplete+mock',
    }

    return json(research)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: msg }, 500)
  }
})

// ---------- Google Autocomplete ----------

const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search'

async function fetchSuggestions(query: string): Promise<string[]> {
  const url = `${SUGGEST_URL}?client=firefox&hl=pt-BR&gl=br&q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 ads-dash-seo/1.0' },
  })
  if (!res.ok) throw new Error(`suggest ${res.status}`)
  const data = await res.json()
  // formato: ["query", ["s1","s2",...], ...]
  const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] as string[] : []
  return list.map(s => s.trim()).filter(Boolean)
}

async function fetchIdeias(termo: string): Promise<KeywordIdea[]> {
  const suggestions = await fetchSuggestions(termo)
  const filtered = dedupe(
    suggestions
      .filter(s => s.toLowerCase() !== termo)
      .filter(s => !isQuestionShape(s))
  ).slice(0, 6)

  return filtered.map(t => ({
    termo:       t,
    volume:      mockVolumeFor(t),
    dificuldade: mockDifficulty(t),
    intent:      heuristicIntent(t),
  }))
}

async function fetchPerguntas(termo: string): Promise<string[]> {
  const prefixes = ['como', 'quanto', 'qual', 'onde']
  const buckets = await Promise.all(prefixes.map(p =>
    fetchSuggestions(`${p} ${termo}`).catch(() => [])
  ))
  const flat = buckets.flat()
  const questions = dedupe(
    flat
      .filter(s => isQuestionShape(s))
      .map(s => capitalizeFirst(s.endsWith('?') ? s : `${s}?`))
  )
  return questions.slice(0, 4)
}

function isQuestionShape(s: string): boolean {
  return /^(como|quanto|qual|quais|o que|onde|por que|porque|quando|serve|vale|faz mal)\b/i.test(s.trim())
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of arr) {
    const k = s.toLowerCase()
    if (!seen.has(k)) { seen.add(k); out.push(s) }
  }
  return out
}

// ---------- Mocks determinísticos + heurísticas ----------

function hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function mockVolume(t: string): number { return 200 + (hash(t) % 9800) }
function mockVolumeFor(t: string): number { return 80 + (hash(t) % 4200) }
function mockDifficulty(t: string): Dificuldade {
  return (['baixa', 'média', 'alta'] as const)[hash(t) % 3]
}
function mockCPC(t: string): number {
  return +(0.4 + ((hash(t) >> 3) % 350) / 100).toFixed(2)
}
function mockTrend(t: string): number {
  return ((hash(t) >> 5) % 60) - 20   // -20 a +40 (%)
}

function heuristicIntent(t: string): Intent {
  const s = t.toLowerCase()
  if (/\b(perto de mim|em bh|belo horizonte|savassi|lourdes|buritis|funcion[aá]rios)\b/.test(s)) return 'local'
  if (/\b(pre[çc]o|custa|orçamento|comprar|contratar|agendar)\b/.test(s)) return 'transacional'
  if (/\b(melhor|melhores|vs|comparação|vale a pena|top)\b/.test(s)) return 'comercial'
  return 'informacional'
}

// ---------- utils ----------

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
