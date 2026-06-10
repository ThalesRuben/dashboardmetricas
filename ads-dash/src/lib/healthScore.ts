// Health Score — um número 0-100 do quão saudável o marketing está
// agora, decomposto em 4 dimensões. Inspirado em Apple Health / Whoop.

import type { MetricsSummary } from '@/features/ads/api/types'
import type { IgData } from '@/app/providers/MetricsContext'
import type { WhatsAppSummary } from '@/features/whatsapp/api/types'

export type HealthTone = 'good' | 'warn' | 'bad' | 'accent'

export interface HealthDimension {
  key: 'verba' | 'conteudo' | 'atendimento' | 'reputacao'
  label: string
  score: number
  tone: HealthTone
  txt: string
}

export interface HealthVerdict {
  label: 'EXCELENTE' | 'SAUDÁVEL' | 'ATENÇÃO' | 'CRÍTICO'
  tone: HealthTone
}

export interface HealthResult {
  total: number
  trend: number
  verdict: HealthVerdict
  dims: HealthDimension[]
}

export interface ComputeHealthInput {
  summary?: MetricsSummary | null
  prev?: MetricsSummary | null
  ig?: IgData | null
  whatsapp?: WhatsAppSummary | null
  /** Reservado pra fase 2 — sinais reputacionais externos. */
  competitors?: unknown
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// curva sigmoide leve — converte uma razão (atual/meta) em score 0-100
// com saturação suave: 100% bate 75 pts, 130% bate ~90, 200% bate ~98.
function score(ratio: number): number {
  const r = Math.max(0, ratio)
  return Math.round(clamp(100 * (1 - Math.exp(-1.5 * r)), 0, 100))
}

const NOTE = (tone: HealthTone, txt: string): { tone: HealthTone; txt: string } => ({ tone, txt })

export function computeHealth({ summary, prev, ig, whatsapp }: ComputeHealthInput = {}): HealthResult {
  const dims: HealthDimension[] = []

  // 1. VERBA — eficiência: receita gerada por R$1 investido (ROAS) vs meta 4
  if (summary?.roas != null) {
    const s = score(summary.roas / 4)
    const note = summary.roas >= 4
      ? NOTE('good',    `ROAS ${summary.roas.toFixed(2)}x — acima da meta`)
      : summary.roas >= 3
      ? NOTE('warn',    `ROAS ${summary.roas.toFixed(2)}x — perto da meta`)
      : NOTE('bad',     `ROAS ${summary.roas.toFixed(2)}x — abaixo do mínimo`)
    dims.push({ key: 'verba', label: 'Verba', score: s, ...note })
  }

  // 2. CONTEÚDO — engajamento orgânico do Instagram vs benchmark 5%
  if (ig?.account?.engajamento_taxa != null) {
    const eng = Number(ig.account.engajamento_taxa)
    const s = score(eng / 5)
    const note = eng >= 5
      ? NOTE('good', `Engajamento ${eng.toFixed(1)}% — saudável`)
      : NOTE('warn', `Engajamento ${eng.toFixed(1)}% — mire em 5%+`)
    dims.push({ key: 'conteudo', label: 'Conteúdo', score: s, ...note })
  }

  // 3. ATENDIMENTO — taxa de resposta WhatsApp + tempo
  if (whatsapp?.resumo) {
    const r = whatsapp.resumo
    const sResp = score(r.taxa_resposta / 95)
    const sTempo = score((30 - Math.min(r.tempo_resposta_min, 30)) / 25)
    const s = Math.round((sResp + sTempo) / 2)
    const note = s >= 75
      ? NOTE('good', `${r.taxa_resposta}% respondidas em ${r.tempo_resposta_min}min`)
      : NOTE('warn', `Resposta lenta ou incompleta — meta < 10 min e > 95%`)
    dims.push({ key: 'atendimento', label: 'Atendimento', score: s, ...note })
  }

  // 4. REPUTAÇÃO — crescimento de seguidores
  if (ig?.account?.seguidores_delta_30d != null) {
    const novos = ig.account.seguidores_delta_30d
    const baseSeg = Math.max(ig.account.seguidores - novos, 1)
    const growthPct = (novos / baseSeg) * 100
    const s = score(growthPct / 5)
    const note = growthPct >= 5
      ? NOTE('good', `+${growthPct.toFixed(1)}% de seguidores em 30d`)
      : growthPct >= 2
      ? NOTE('warn', `+${growthPct.toFixed(1)}% em 30d — desacelerou`)
      : NOTE('bad',  `+${growthPct.toFixed(1)}% — quase parado`)
    dims.push({ key: 'reputacao', label: 'Reputação', score: s, ...note })
  }

  const total = dims.length
    ? Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length)
    : 50

  const prevRoas = prev?.roas
  const trend = (summary?.roas != null && prevRoas != null && prevRoas > 0)
    ? +((summary.roas - prevRoas) / prevRoas * 100).toFixed(1)
    : 0

  const verdict: HealthVerdict =
    total >= 80 ? { label: 'EXCELENTE', tone: 'accent' } :
    total >= 60 ? { label: 'SAUDÁVEL',  tone: 'good'   } :
    total >= 40 ? { label: 'ATENÇÃO',   tone: 'warn'   } :
                  { label: 'CRÍTICO',   tone: 'bad'    }

  return { total, trend, verdict, dims }
}
