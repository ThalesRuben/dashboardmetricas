// Scout de influenciadores — recomenda quais perfis combinam com a marca.
// Pontua candidatos contra a diretriz de marketing (Cérebro da IA) usando
// regras transparentes. Roda 100% offline (fallback local de uma IA).
//
// Dois modos:
//   scoutInfluencers(brain, currentHandles)  → ranqueia o pool de radar
//   analyzeHandles(handles, brain, criterio) → analisa @ que o usuário colar

import type { AiBrain } from '@/features/ai/api/types'

// ============================================================================
// Tipos públicos
// ============================================================================

export type Plataforma = 'Instagram' | 'TikTok' | 'YouTube'
export type Nicho = 'beleza/cabelo' | 'beleza/maquiagem' | 'moda' | 'lifestyle' | 'fitness'
export type Local = 'mesma cidade' | 'regional' | 'nacional'
export type Tier = 'micro' | 'médio' | 'macro' | 'mega'
export type VereditoTone = 'good' | 'accent' | 'warn' | 'bad'

export interface ProfileSeed {
  nome: string
  plataforma: Plataforma
  nicho: Nicho
  seguidores: number
  engajamento: number
  fem_pct: number
  faixa: [number, number]
  local: Local
  estetica: string
  citou_concorrente?: boolean
  brand_safe?: boolean
  custo?: number
  estimated?: boolean
}

export interface Candidate extends ProfileSeed {
  id: string
  handle: string
}

export interface Veredito {
  label: 'Altamente recomendado' | 'Recomendado' | 'Vale testar' | 'Pouco aderente'
  tone: VereditoTone
}

export interface ScoredCandidate extends Candidate {
  score: number
  veredito: Veredito
  pros: string[]
  contras: string[]
  estrategia: string
  tier: Tier
  custo: number
}

// ============================================================================

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

// ---- perfis conhecidos (com dados estimados para o nicho salão/BH) ----
// chave = handle sem @, minúsculo.
export const SEED_PROFILES: Record<string, ProfileSeed> = {
  // pool de radar (descoberta automática)
  'gabiglam':     { nome: 'Gabi Glam', plataforma: 'Instagram', nicho: 'beleza/cabelo', seguidores: 14200, engajamento: 11.5, fem_pct: 95, faixa: [22, 38], local: 'mesma cidade', estetica: 'loiro, antes e depois' },
  'manubeauty':   { nome: 'Manu Beauty', plataforma: 'Instagram', nicho: 'beleza/cabelo', seguidores: 38000, engajamento: 8.2, fem_pct: 92, faixa: [25, 40], local: 'mesma cidade', estetica: 'clean, transformação' },
  'rafamakes':    { nome: 'Rafa Makes', plataforma: 'TikTok', nicho: 'beleza/maquiagem', seguidores: 120000, engajamento: 6.1, fem_pct: 88, faixa: [18, 30], local: 'nacional', estetica: 'tutorial, trends' },
  'drcabelo':     { nome: 'Dr. Cabelo', plataforma: 'YouTube', nicho: 'beleza/cabelo', seguidores: 85000, engajamento: 4.0, fem_pct: 64, faixa: [30, 50], local: 'nacional', estetica: 'educativo' },
  'biafit':       { nome: 'Bia Fit', plataforma: 'Instagram', nicho: 'fitness', seguidores: 95000, engajamento: 5.5, fem_pct: 78, faixa: [20, 35], local: 'regional', estetica: 'lifestyle saudável' },
  'lelifestyle':  { nome: 'Lê Lifestyle', plataforma: 'Instagram', nicho: 'lifestyle', seguidores: 210000, engajamento: 2.4, fem_pct: 70, faixa: [25, 45], local: 'nacional', estetica: 'aspiracional' },
  'taytrends':    { nome: 'Tay Trends', plataforma: 'TikTok', nicho: 'moda', seguidores: 320000, engajamento: 3.1, fem_pct: 82, faixa: [16, 28], local: 'nacional', estetica: 'moda, viral', citou_concorrente: true },

  // perfis enviados pelo usuário (estimativa de nicho beleza/BH)
  'brendab.costa':   { nome: 'Brenda Costa', plataforma: 'Instagram', nicho: 'beleza/cabelo', seguidores: 22000, engajamento: 9.1, fem_pct: 93, faixa: [24, 40], local: 'mesma cidade', estetica: 'loiro, mechas' },
  'lorena_maruch':   { nome: 'Lorena Maruch', plataforma: 'Instagram', nicho: 'lifestyle', seguidores: 180000, engajamento: 2.8, fem_pct: 74, faixa: [22, 38], local: 'nacional', estetica: 'moda, lifestyle' },
  'bruna_acfreitas': { nome: 'Bruna Freitas', plataforma: 'Instagram', nicho: 'beleza/maquiagem', seguidores: 41000, engajamento: 6.4, fem_pct: 90, faixa: [20, 34], local: 'regional', estetica: 'maquiagem, beleza' },
  'teteclementino':  { nome: 'Teté Clementino', plataforma: 'Instagram', nicho: 'lifestyle', seguidores: 95000, engajamento: 3.6, fem_pct: 68, faixa: [25, 45], local: 'nacional', estetica: 'lifestyle' },
  'anamaaro':        { nome: 'Ana Maaro', plataforma: 'Instagram', nicho: 'beleza/cabelo', seguidores: 13000, engajamento: 11.8, fem_pct: 95, faixa: [23, 39], local: 'mesma cidade', estetica: 'cabelo, autoestima' },
  'jadesales':       { nome: 'Jade Sales', plataforma: 'TikTok', nicho: 'moda', seguidores: 220000, engajamento: 2.2, fem_pct: 80, faixa: [18, 30], local: 'nacional', estetica: 'moda, viral' },
  'ligialapertosa':  { nome: 'Lígia Lapertosa', plataforma: 'Instagram', nicho: 'lifestyle', seguidores: 60000, engajamento: 5.0, fem_pct: 88, faixa: [28, 45], local: 'regional', estetica: 'lifestyle, maternidade' },
  'lafernandesss':   { nome: 'Lá Fernandes', plataforma: 'Instagram', nicho: 'beleza/cabelo', seguidores: 28000, engajamento: 8.7, fem_pct: 91, faixa: [24, 42], local: 'mesma cidade', estetica: 'cabelo, transformação' },
}

export const CANDIDATE_POOL: Candidate[] = (
  ['gabiglam', 'manubeauty', 'rafamakes', 'drcabelo', 'biafit', 'lelifestyle', 'taytrends'] as const
).map(h => ({ id: h, handle: '@' + h, ...SEED_PROFILES[h] }))

const NICHO_FIT: Record<Nicho, number> = { 'beleza/cabelo': 100, 'beleza/maquiagem': 82, 'moda': 64, 'lifestyle': 58, 'fitness': 42 }
const LOCAL_FIT: Record<Local, number> = { 'mesma cidade': 100, 'regional': 78, 'nacional': 55 }

function tierFit(seg: number): { score: number; tier: Tier } {
  if (seg < 25000)  return { score: 100, tier: 'micro' }
  if (seg < 80000)  return { score: 88,  tier: 'médio' }
  if (seg < 200000) return { score: 66,  tier: 'macro' }
  return { score: 45, tier: 'mega' }
}

function rangeOverlap(a: [number, number], b: [number, number]): number {
  const lo = Math.max(a[0], b[0]); const hi = Math.min(a[1], b[1])
  return hi <= lo ? 0 : (hi - lo) / (b[1] - b[0])
}

function audienceFit(c: ProfileSeed, brain: AiBrain | null | undefined): number {
  let score = (c.fem_pct / 100) * 55
  score += rangeOverlap(c.faixa, [25, 45]) * 30
  score += (LOCAL_FIT[c.local] || 55) / 100 * 15
  const kw = (brain?.palavras_chave || '').toLowerCase()
  if (kw && c.estetica.split(',').some(t => kw.includes(t.trim()))) score += 6
  return clamp(score)
}

function costEfficiency(c: ProfileSeed & { custo: number }): number {
  const alcanceEngajado = c.seguidores * (c.engajamento / 100)
  return clamp((alcanceEngajado / c.custo / 3) * 100)
}

// estima o cachê quando não informado
function estimateCusto(c: ProfileSeed): number {
  if (c.custo) return c.custo
  return Math.round((c.seguidores * 0.035 + 200) / 50) * 50
}

const WEIGHTS = { nicho: 0.28, audiencia: 0.24, engajamento: 0.18, tier: 0.12, custo: 0.12, seguranca: 0.06 }

// aplica o critério livre do usuário ("foco em loiro", "só BH", "micro"...)
function criterioBonus(c: ProfileSeed, criterio: string): number {
  if (!criterio) return 0
  const q = criterio.toLowerCase()
  let bonus = 0
  if (/(loiro|mecha|cabelo|cor)/.test(q) && c.nicho === 'beleza/cabelo') bonus += 8
  if (/(maquiagem|make)/.test(q) && c.nicho === 'beleza/maquiagem') bonus += 6
  if (/(bh|local|cidade|perto)/.test(q) && c.local === 'mesma cidade') bonus += 8
  if (/(micro|barato|permuta)/.test(q) && c.seguidores < 25000) bonus += 7
  if (/(engaj)/.test(q) && c.engajamento >= 8) bonus += 6
  if (/(alcance|grande|mega)/.test(q) && c.seguidores >= 100000) bonus += 6
  return bonus
}

export function scoreCandidate(c0: Candidate, brain: AiBrain | null | undefined, criterio = ''): ScoredCandidate {
  const c = { ...c0, custo: estimateCusto(c0) }
  const nicho = NICHO_FIT[c.nicho] ?? 50
  const audiencia = audienceFit(c, brain)
  const engajamento = clamp((c.engajamento / 10) * 100)
  const t = tierFit(c.seguidores)
  const custo = costEfficiency(c)
  const seguranca = clamp((c.brand_safe === false ? 30 : 100) - (c.citou_concorrente ? 35 : 0))

  const base =
    nicho * WEIGHTS.nicho + audiencia * WEIGHTS.audiencia + engajamento * WEIGHTS.engajamento +
    t.score * WEIGHTS.tier + custo * WEIGHTS.custo + seguranca * WEIGHTS.seguranca

  const score = clamp(base + criterioBonus(c, criterio))

  const veredito: Veredito =
    score >= 80 ? { label: 'Altamente recomendado', tone: 'good' } :
    score >= 66 ? { label: 'Recomendado',           tone: 'accent' } :
    score >= 52 ? { label: 'Vale testar',           tone: 'warn' } :
                  { label: 'Pouco aderente',        tone: 'bad' }

  const pros: string[] = []
  const contras: string[] = []
  if (nicho >= 82) pros.push(`Nicho ${c.nicho} alinhado ao salão`)
  else contras.push(`Nicho ${c.nicho} fora do core de beleza/cabelo`)
  if (c.fem_pct >= 85) pros.push(`${c.fem_pct}% de público feminino`)
  if (c.local === 'mesma cidade') pros.push('Público na sua cidade — vira agenda')
  else if (c.local === 'nacional') contras.push('Audiência nacional dispersa — pouco agendamento local')
  if (c.engajamento >= 8) pros.push(`Engajamento alto (${c.engajamento}%)`)
  else if (c.engajamento < 4) contras.push(`Engajamento baixo (${c.engajamento}%)`)
  if (t.tier === 'micro') pros.push('Micro: barato, autêntico, ótimo ROI')
  if (t.tier === 'mega') contras.push('Mega: caro e impessoal pro porte do salão')
  if (custo >= 70) pros.push('Ótimo custo-benefício de alcance engajado')
  else if (custo < 40) contras.push('Custo alto pro retorno engajado estimado')
  if (c.citou_concorrente) contras.push('⚠ Já divulgou um concorrente')

  const estrategia =
    t.tier === 'micro' ? 'Comece com permuta (serviço) + cupom exclusivo. Baixo risco.' :
    t.tier === 'médio' ? 'Permuta + cachê pequeno + cupom. Mensure por 60 dias.' :
                         'Campanha paga pontual com meta de agendamentos. 1 post + stories.'

  return { ...c, score, veredito, pros, contras, estrategia, tier: t.tier }
}

export function scoutInfluencers(
  brain: AiBrain | null | undefined,
  currentHandles: string[] = [],
  pool: Candidate[] = CANDIDATE_POOL,
): ScoredCandidate[] {
  const taken = new Set(currentHandles.map(h => (h || '').toLowerCase()))
  return pool
    .filter(c => !taken.has(c.handle.toLowerCase()))
    .map(c => scoreCandidate(c, brain))
    .sort((a, b) => b.score - a.score)
}

// hash determinístico simples (pra gerar perfil plausível de @ desconhecido)
function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function generateProfile(handle: string): ProfileSeed {
  const h = hash(handle)
  const nichos: Nicho[] = ['beleza/cabelo', 'beleza/maquiagem', 'lifestyle', 'moda']
  const locais: Local[] = ['mesma cidade', 'regional', 'nacional']
  return {
    nome: handle.replace(/[._]/g, ' ').replace(/\b\w/g, m => m.toUpperCase()),
    plataforma: 'Instagram',
    nicho: nichos[h % nichos.length],
    seguidores: 5000 + (h % 90) * 2000,
    engajamento: +(3 + (h % 80) / 10).toFixed(1),
    fem_pct: 70 + (h % 26),
    faixa: [22 + (h % 6), 38 + (h % 8)],
    local: locais[(h >> 3) % locais.length],
    estetica: 'beleza',
    estimated: true,
  }
}

export function normalizeHandle(raw: string | undefined | null): string {
  return (raw || '').trim().replace(/^@/, '').replace(/\/$/, '').toLowerCase()
}

// analisa uma lista de @ (cola do usuário) e ranqueia
export function analyzeHandles(
  rawHandles: string[],
  brain: AiBrain | null | undefined,
  criterio = '',
): ScoredCandidate[] {
  const seen = new Set<string>()
  return rawHandles
    .map(normalizeHandle)
    .filter(h => h && !seen.has(h) && seen.add(h))
    .map(h => {
      const seed = SEED_PROFILES[h]
      const prof: Candidate = seed
        ? { id: h, handle: '@' + h, ...seed }
        : { id: h, handle: '@' + h, ...generateProfile(h) }
      return scoreCandidate(prof, brain, criterio)
    })
    .sort((a, b) => b.score - a.score)
}
