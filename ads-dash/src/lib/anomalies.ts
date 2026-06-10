// Detector de anomalias — varre os últimos N dias e destaca o que
// fugiu do padrão. Estilo Datadog/Anodot, mas simples e local.

import type { DailyMetric } from '@/features/ads/api/types'

export type AnomalyTone = 'bad' | 'good'
export type AnomalySeverity = 'media' | 'alta'

export interface Anomaly {
  key: string
  label: string
  severity: AnomalySeverity
  tone: AnomalyTone
  delta: number
  atual: string
  esperado: string
  direcao: 'subiu' | 'caiu'
  mensagem: string
}

interface KeyDef {
  key: keyof DailyMetric
  label: string
  betterUp: boolean
  fmt: (v: number) => string
}

const KEYS: KeyDef[] = [
  { key: 'roas',         label: 'ROAS',         betterUp: true,  fmt: v => v.toFixed(2) + 'x' },
  { key: 'ctr',          label: 'CTR',          betterUp: true,  fmt: v => v.toFixed(2) + '%' },
  { key: 'mensagens',    label: 'Mensagens',    betterUp: true,  fmt: v => Math.round(v).toLocaleString('pt-BR') },
  { key: 'agendamentos', label: 'Agendamentos', betterUp: true,  fmt: v => Math.round(v).toLocaleString('pt-BR') },
  { key: 'vendas',       label: 'Vendas',       betterUp: true,  fmt: v => Math.round(v).toLocaleString('pt-BR') },
  { key: 'investido',    label: 'Investimento', betterUp: false, fmt: v => 'R$ ' + Math.round(v).toLocaleString('pt-BR') },
]

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / (arr.length || 1)
}
function std(arr: number[]): number {
  const m = mean(arr)
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length || 1)
  return Math.sqrt(v)
}

// detecta valores que ficam fora de 2 desvios-padrão da média histórica
export function detectAnomalies(days: DailyMetric[] = []): Anomaly[] {
  if (!days || days.length < 4) return []
  const today = days[days.length - 1]
  const history = days.slice(0, -1)

  const out: Anomaly[] = []
  for (const { key, label, betterUp, fmt } of KEYS) {
    const series = history.map(d => Number(d[key]) || 0)
    const m = mean(series)
    const sd = std(series)
    if (sd === 0 || m === 0) continue

    const val = Number(today[key]) || 0
    const z = (val - m) / sd
    const pct = +((val - m) / m * 100).toFixed(1)

    // só destaca desvios relevantes (>1.6σ) E variação >15%
    if (Math.abs(z) < 1.6 || Math.abs(pct) < 15) continue

    const acima = z > 0
    const ruim = (acima && !betterUp) || (!acima && betterUp)
    out.push({
      key: String(key),
      label,
      severity: Math.abs(z) >= 2.4 ? 'alta' : 'media',
      tone: ruim ? 'bad' : 'good',
      delta: pct,
      atual:    fmt(val),
      esperado: fmt(m),
      direcao: acima ? 'subiu' : 'caiu',
      mensagem: ruim
        ? `${label} ${acima ? 'subiu' : 'caiu'} ${Math.abs(pct).toFixed(0)}% acima do padrão — investigue`
        : `${label} ${acima ? 'subiu' : 'caiu'} ${Math.abs(pct).toFixed(0)}% acima do padrão — sinal positivo`,
    })
  }

  // mais severos primeiro
  out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return out
}
