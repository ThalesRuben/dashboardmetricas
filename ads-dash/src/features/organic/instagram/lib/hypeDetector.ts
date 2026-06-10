// Detector de viralização ("hype")
//
// Define se um conteúdo está acima da curva comparado ao histórico do perfil.
// Critérios (qualquer um desses dispara hype):
//
//   1. Engajamento >= 1.8x da média do perfil
//   2. Alcance     >= 1.5x a média OU >= 50% dos seguidores
//   3. Plays (Reels) >= 3x a média de Reels
//   4. Salvamentos >= 2x a média (sinal forte de conteúdo de valor)
//   5. Compartilhamentos >= 2x a média (sinal forte de viralização)
//
// Score:
//   1 critério atingido  → 'warm'    (subindo)
//   2 critérios          → 'hot'     (no hype)
//   3+ critérios         → 'blazing' (viralizou)

import type { IgPost, IgAccount } from '@/app/providers/MetricsContext'

export type HypeLevel = 'warm' | 'hot' | 'blazing'

export interface HypeReason {
  key: string
  label: string
}

export interface HypeResult {
  post: IgPost
  level: HypeLevel | null
  score: number
  reasons: HypeReason[]
}

export interface DetectHypeResult {
  hypePosts: HypeResult[]
  topHype: HypeResult | null
}

const HYPE_WINDOW_DAYS = 14

export function detectHype(
  posts: IgPost[] | null | undefined,
  account: IgAccount | null | undefined,
): DetectHypeResult {
  if (!posts?.length) return { hypePosts: [], topHype: null }

  const recent = posts.filter(p => withinDays(p.publicado_em, HYPE_WINDOW_DAYS))
  if (!recent.length) return { hypePosts: [], topHype: null }

  // baseline: média do que o perfil costuma performar
  const reels = recent.filter(p => p.tipo === 'REEL')
  const avgEng    = avg(recent, 'engajamento_taxa')
  const avgReach  = avg(recent, 'alcance')
  const avgSaves  = avg(recent, 'salvamentos')
  const avgShares = avg(recent, 'compartilhamentos')
  const avgPlays  = avg(reels,  'plays')
  const followers = account?.seguidores || 0

  const evaluated: HypeResult[] = recent.map(p => {
    const reasons: HypeReason[] = []

    if (avgEng > 0 && p.engajamento_taxa >= avgEng * 1.8) {
      reasons.push({ key: 'engajamento', label: `Engajamento ${(p.engajamento_taxa / avgEng).toFixed(1)}x acima da média` })
    }
    if (avgReach > 0 && p.alcance >= avgReach * 1.5) {
      reasons.push({ key: 'alcance', label: `Alcance ${(p.alcance / avgReach).toFixed(1)}x acima da média` })
    }
    if (followers > 0 && p.alcance >= followers * 0.5) {
      reasons.push({ key: 'reach-followers', label: `Alcançou ${Math.round((p.alcance/followers)*100)}% dos seguidores` })
    }
    if (avgPlays > 0 && p.tipo === 'REEL' && p.plays >= avgPlays * 3) {
      reasons.push({ key: 'plays', label: `${(p.plays / avgPlays).toFixed(1)}x mais plays que a média de Reels` })
    }
    if (avgSaves > 0 && p.salvamentos >= avgSaves * 2) {
      reasons.push({ key: 'saves', label: `Salvamentos ${(p.salvamentos/avgSaves).toFixed(1)}x acima da média` })
    }
    if (avgShares > 0 && p.compartilhamentos >= avgShares * 2) {
      reasons.push({ key: 'shares', label: `Compartilhamentos ${(p.compartilhamentos/avgShares).toFixed(1)}x acima da média` })
    }

    const score = reasons.length
    let level: HypeLevel | null = null
    if      (score >= 3) level = 'blazing'
    else if (score === 2) level = 'hot'
    else if (score === 1) level = 'warm'

    return { post: p, level, score, reasons }
  })

  const hypePosts = evaluated
    .filter(e => e.level)
    .sort((a, b) => b.score - a.score || b.post.engajamento_taxa - a.post.engajamento_taxa)

  return {
    hypePosts,
    topHype: hypePosts[0] || null,
  }
}

export interface HypeLevelConfig {
  label: string
  icon: string
  color: string
  bg: string
  bgDark: string
}

export const HYPE_LEVELS: Record<HypeLevel, HypeLevelConfig> = {
  warm: {
    label: 'Subindo',
    icon: '📈',
    color: '#F58529',
    bg:    '#FFF4E5',
    bgDark:'#3F2D10',
  },
  hot: {
    label: 'No hype',
    icon: '🔥',
    color: '#E1306C',
    bg:    '#FFE5EE',
    bgDark:'#3F1828',
  },
  blazing: {
    label: 'Viralizando',
    icon: '🚀',
    color: '#8134AF',
    bg:    '#F2E5FA',
    bgDark:'#2A1840',
  },
}

function avg<T>(arr: T[] | null | undefined, key: keyof T): number {
  if (!arr?.length) return 0
  const sum = arr.reduce((s, x) => s + (Number(x[key]) || 0), 0)
  return sum / arr.length
}

function withinDays(iso: string | null | undefined, days: number): boolean {
  if (!iso) return false
  const ms = days * 24 * 60 * 60 * 1000
  return Date.now() - new Date(iso).getTime() < ms
}
