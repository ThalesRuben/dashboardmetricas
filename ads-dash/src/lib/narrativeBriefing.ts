// Constrói um resumo narrativo da semana — uma frase pronta que
// substitui o "olhar pra 8 KPIs e tentar entender". Estilo Spotify Wrapped.

import { fmtBRL, fmtNumber, fmtDelta } from '@/shared/lib/format'
import type { MetricsSummary } from '@/features/ads/api/types'
import type { IgData } from '@/app/providers/MetricsContext'

type MoverKey = 'roas' | 'roi' | 'mensagens' | 'agendamentos' | 'vendas' | 'ctr'

interface Mover {
  k: MoverKey
  pct: number
}

export type DestaqueTone = 'up' | 'down'

export interface BriefingDestaque {
  key: MoverKey
  label: string
  delta: number
  tone: DestaqueTone
}

export interface Briefing {
  paragrafo: string
  destaques: BriefingDestaque[]
  proximaAcao: string | null
}

function pctDelta(curr: number | undefined, prev: number | undefined): number {
  if (!prev) return 0
  return +((((curr ?? 0) - prev) / prev) * 100).toFixed(1)
}

// pega a maior variação positiva e a maior queda do conjunto
function findMovers(curr: MetricsSummary, prev?: MetricsSummary | null): { winner: Mover | null; loser: Mover | null } {
  if (!prev) return { winner: null, loser: null }
  const keys: MoverKey[] = ['roas', 'roi', 'mensagens', 'agendamentos', 'vendas', 'ctr']
  const moves: Mover[] = keys.map(k => ({ k, pct: pctDelta(curr[k], prev[k]) }))
  const ranked = moves.filter(m => isFinite(m.pct))
  ranked.sort((a, b) => b.pct - a.pct)
  return {
    winner: ranked[0] && ranked[0].pct > 2 ? ranked[0] : null,
    loser:  ranked.length && ranked[ranked.length - 1].pct < -2 ? ranked[ranked.length - 1] : null,
  }
}

const LABEL: Record<MoverKey, string> = {
  roas: 'ROAS', roi: 'ROI', mensagens: 'mensagens', agendamentos: 'agendamentos',
  vendas: 'vendas', ctr: 'CTR',
}

export function buildBriefing(
  summary: MetricsSummary | null | undefined,
  prev: MetricsSummary | null | undefined,
  ig: IgData | null | undefined,
): Briefing {
  if (!summary) {
    return {
      paragrafo: 'Sem dados suficientes pro resumo desta semana ainda.',
      destaques: [],
      proximaAcao: null,
    }
  }

  const investidoDelta = pctDelta(summary.investido, prev?.investido)
  const receitaDelta   = pctDelta(summary.receita, prev?.receita)
  const eficiencia     = +(receitaDelta - investidoDelta).toFixed(1)
  const { winner, loser } = findMovers(summary, prev)

  // frase 1 — o que aconteceu
  let frase1 = `Nos últimos ${summary.days} dia${summary.days > 1 ? 's' : ''}, você investiu ${fmtBRL(summary.investido)} e fechou ${fmtNumber(summary.vendas)} venda${summary.vendas !== 1 ? 's' : ''}.`
  if (prev) {
    const eficSign = eficiencia >= 0 ? 'ganhou' : 'perdeu'
    frase1 += ` Comparado ao período anterior, você ${eficSign} ${Math.abs(eficiencia)} pontos de eficiência` +
      ` (gastou ${fmtDelta(investidoDelta)}, faturou ${fmtDelta(receitaDelta)}).`
  }

  // frase 2 — destaque positivo/negativo
  let frase2 = ''
  if (winner) {
    frase2 += `O destaque positivo foi ${LABEL[winner.k]}, que subiu ${fmtDelta(winner.pct)}. `
  }
  if (loser) {
    frase2 += `Olha de perto ${LABEL[loser.k]}, que caiu ${fmtDelta(loser.pct)}.`
  }

  // frase 3 — sinal orgânico
  let frase3 = ''
  if (ig?.account) {
    const novos = ig.account.seguidores_delta_30d
    if (novos > 0) frase3 = `No orgânico, +${fmtNumber(novos)} seguidores no Instagram em 30d.`
  }

  // próxima ação sugerida (regra simples)
  let proximaAcao: string | null
  if (summary.roas >= 4) {
    proximaAcao = `ROAS forte (${summary.roas.toFixed(2)}x) — aumente o orçamento dos top-3 anúncios em 20–30%.`
  } else if (summary.roas < 3 && summary.roas > 0) {
    proximaAcao = `ROAS abaixo de 3x — pause os anúncios com ROAS < 2x e teste 2 novos criativos.`
  } else if (loser?.k === 'mensagens') {
    proximaAcao = 'Mensagens em queda — revise o gancho do anúncio CTWA e teste oferta de "agendar grátis".'
  } else if (winner?.k === 'agendamentos') {
    proximaAcao = 'Agendamentos subindo — proteja a operação: confirme que tem agenda disponível pra absorver.'
  } else {
    proximaAcao = 'Sem alerta crítico — boa hora pra rodar 1 teste novo de criativo.'
  }

  const destaques: BriefingDestaque[] = [winner, loser]
    .filter((m): m is Mover => Boolean(m))
    .map(m => ({
      key: m.k,
      label: LABEL[m.k],
      delta: m.pct,
      tone: m.pct >= 0 ? 'up' : 'down',
    }))

  return {
    paragrafo: [frase1, frase2, frase3].filter(Boolean).join(' ').trim(),
    destaques,
    proximaAcao,
  }
}
