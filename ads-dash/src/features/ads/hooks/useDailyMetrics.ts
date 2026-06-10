import { useMemo } from 'react'
import type { DailyMetric, MetricsSummary, DateRange } from '../api/types'

const DAY_PATTERN = [0.85, 1.10, 1.05, 1.00, 1.20, 0.95, 0.70]

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function seedFromDate(d: Date): number {
  const s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  return ((s * 9301 + 49297) % 233280) / 233280
}

function generateDay(date: Date): DailyMetric {
  const dow = date.getDay()
  const factor = DAY_PATTERN[dow]
  const noise = 0.9 + seedFromDate(date) * 0.2

  const investido    = Math.round(800  * factor * noise)
  const receita      = Math.round(3300 * factor * noise * (0.95 + seedFromDate(date) * 0.15))
  const impressoes   = Math.round(11000 * factor * noise)
  const cliques      = Math.round(impressoes * (0.04 + seedFromDate(date) * 0.015))
  const mensagens    = Math.round(cliques * (0.25 + seedFromDate(date) * 0.05))
  const agendamentos = Math.round(mensagens * (0.40 + seedFromDate(date) * 0.05))
  const vendas       = Math.round(agendamentos * (0.55 + seedFromDate(date) * 0.07))
  const roas = +(receita / investido).toFixed(2)
  const roi  = Math.round(((receita - investido) / investido) * 100)
  const ctr  = +((cliques / impressoes) * 100).toFixed(2)
  const posts = Math.random() < 0.42 ? 1 + Math.floor(Math.random() * 2) : 0

  return {
    date: dateKey(date),
    iso: date.toISOString(),
    dow,
    investido, receita, impressoes, cliques,
    mensagens, agendamentos, vendas, roas, roi, ctr,
    ctrMeta: +(ctr * 0.85).toFixed(2),
    ctrGoogle: +(ctr * 1.15).toFixed(2),
    posts,
    funil: { impressoes, cliques, mensagens, agendamentos, vendas },
  }
}

export function generateDailyRange(from?: Date | null, to?: Date | null): DailyMetric[] {
  if (!from || !to) return []
  const out: DailyMetric[] = []
  const cur = new Date(from)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)
  while (cur <= end) {
    out.push(generateDay(new Date(cur)))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function aggregate(days: DailyMetric[] | null | undefined): MetricsSummary | null {
  if (!days?.length) return null
  const sum = (k: keyof DailyMetric): number =>
    days.reduce((s, d) => s + ((d[k] as number) || 0), 0)
  const avg = (k: keyof DailyMetric): number => +(sum(k) / days.length).toFixed(2)
  const investido = sum('investido')
  const receita   = sum('receita')
  return {
    days: days.length,
    investido, receita,
    impressoes: sum('impressoes'),
    cliques:    sum('cliques'),
    mensagens:  sum('mensagens'),
    agendamentos: sum('agendamentos'),
    vendas:     sum('vendas'),
    posts:      sum('posts'),
    roas: investido > 0 ? +(receita / investido).toFixed(2) : 0,
    roi:  investido > 0 ? Math.round(((receita - investido) / investido) * 100) : 0,
    ctr:       avg('ctr'),
    ctrMeta:   avg('ctrMeta'),
    ctrGoogle: avg('ctrGoogle'),
  }
}

export interface UseDailyMetricsReturn {
  days: DailyMetric[]
  summary: MetricsSummary | null
}

export function useDailyMetrics(range?: DateRange | null): UseDailyMetricsReturn {
  return useMemo(() => {
    if (!range?.from || !range?.to) return { days: [], summary: null }
    const days = generateDailyRange(range.from, range.to)
    return { days, summary: aggregate(days) }
  }, [range?.from?.getTime?.(), range?.to?.getTime?.()])
}

export function deltaPct(curr: number, prev: number): number {
  if (!prev) return 0
  return +(((curr - prev) / prev) * 100).toFixed(1)
}

export function previousRange(range?: DateRange | null): { from: Date; to: Date } | null {
  if (!range?.from || !range?.to) return null
  const days = Math.round((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const prevTo = new Date(range.from)
  prevTo.setDate(prevTo.getDate() - 1)
  prevTo.setHours(23, 59, 59, 999)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - days + 1)
  prevFrom.setHours(0, 0, 0, 0)
  return { from: prevFrom, to: prevTo }
}
