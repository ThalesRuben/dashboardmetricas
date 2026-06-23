// Mock — armazena em localStorage por (periodo, periodo_ref) pra UI funcionar
// sem Supabase configurado. Pré-popula com valores razoáveis pra o salão.

import type { MetasRepo } from './metasRepo';
import type { MetaKpi, MetaPeriodo } from './types';
import { KPIS_PADRAO } from './types';

const STORAGE_KEY = 'ads-dash:metas_kpi'

interface Stored {
  [chave: string]: Record<string, { valor_meta: number; valor_realizado: number }>
}

function chave(periodo: MetaPeriodo, periodoRef: string) {
  return `${periodo}:${periodoRef}`
}

function ler(): Stored {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function escrever(s: Stored) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

// Defaults razoáveis pra cada período começar populado.
function defaultsPorPeriodo(periodo: MetaPeriodo): Record<string, { valor_meta: number; valor_realizado: number }> {
  if (periodo === 'semana') {
    return {
      faturamento:        { valor_meta: 12000,  valor_realizado: 8400 },
      conversas_whatsapp: { valor_meta: 80,     valor_realizado: 54 },
      leads:              { valor_meta: 30,     valor_realizado: 22 },
      agendamentos:       { valor_meta: 18,     valor_realizado: 11 },
      vendas:             { valor_meta: 12,     valor_realizado: 7 },
      investimento_ads:   { valor_meta: 1200,   valor_realizado: 880 },
      roas_medio:         { valor_meta: 4.0,    valor_realizado: 3.6 },
    }
  }
  if (periodo === 'trimestre') {
    return {
      faturamento:        { valor_meta: 160000, valor_realizado: 92000 },
      conversas_whatsapp: { valor_meta: 1000,   valor_realizado: 620 },
      leads:              { valor_meta: 400,    valor_realizado: 245 },
      agendamentos:       { valor_meta: 240,    valor_realizado: 138 },
      vendas:             { valor_meta: 160,    valor_realizado: 88 },
      investimento_ads:   { valor_meta: 16000,  valor_realizado: 9800 },
      roas_medio:         { valor_meta: 4.2,    valor_realizado: 3.7 },
    }
  }
  return {
    faturamento:        { valor_meta: 720000, valor_realizado: 145000 },
    conversas_whatsapp: { valor_meta: 4500,   valor_realizado: 980 },
    leads:              { valor_meta: 1800,   valor_realizado: 380 },
    agendamentos:       { valor_meta: 1080,   valor_realizado: 215 },
    vendas:             { valor_meta: 720,    valor_realizado: 138 },
    investimento_ads:   { valor_meta: 72000,  valor_realizado: 15400 },
    roas_medio:         { valor_meta: 4.5,    valor_realizado: 3.8 },
  }
}

function montar(periodo: MetaPeriodo, periodoRef: string): MetaKpi[] {
  const store = ler()
  const slot = store[chave(periodo, periodoRef)] || defaultsPorPeriodo(periodo)
  return KPIS_PADRAO.map((def, i) => ({
    id: `${periodoRef}-${def.kpi}`,
    kpi: def.kpi,
    label: def.label,
    unidade: def.unidade,
    ordem: def.ordem,
    valor_meta: slot[def.kpi]?.valor_meta ?? 0,
    valor_realizado: slot[def.kpi]?.valor_realizado ?? 0,
  }))
}

export const mockMetasRepo: MetasRepo = {
  async listarPorPeriodo(periodo, periodoRef) {
    return montar(periodo, periodoRef)
  },

  async upsert(input) {
    const store = ler()
    const k = chave(input.periodo, input.periodo_ref)
    const slot = store[k] || {}
    slot[input.kpi] = {
      valor_meta: input.valor_meta,
      valor_realizado: input.valor_realizado ?? slot[input.kpi]?.valor_realizado ?? 0,
    }
    store[k] = slot
    escrever(store)
    return `mock-${k}-${input.kpi}`
  },
}
