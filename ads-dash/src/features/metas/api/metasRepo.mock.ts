// Mock — armazena em localStorage por (periodo, periodo_ref) pra UI funcionar
// sem Supabase configurado. Pré-popula com valores razoáveis pra o salão.

import type { MetasRepo } from './metasRepo';
import type { MetaKpi, MetaPeriodo } from './types';
import { KPIS_PADRAO } from './types';

const STORAGE_KEY = 'ads-dash:metas_kpi'

interface StoredSlot {
  valor_meta: number
  valor_realizado: number
  valor_meta_min?: number | null
  valor_meta_max?: number | null
}

interface Stored {
  [chave: string]: Record<string, StoredSlot>
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
function defaultsPorPeriodo(periodo: MetaPeriodo): Record<string, StoredSlot> {
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
  if (periodo === 'trimestre' || periodo === 'mes') {
    return {}
  }
  // ano
  return {}
}

function montar(periodo: MetaPeriodo, periodoRef: string): MetaKpi[] {
  const store = ler()
  const slot = store[chave(periodo, periodoRef)] || defaultsPorPeriodo(periodo)
  return KPIS_PADRAO.map((def) => ({
    id: `${periodoRef}-${def.kpi}`,
    kpi: def.kpi,
    label: def.label,
    unidade: def.unidade,
    ordem: def.ordem,
    valor_meta: slot[def.kpi]?.valor_meta ?? 0,
    valor_meta_min: slot[def.kpi]?.valor_meta_min ?? null,
    valor_meta_max: slot[def.kpi]?.valor_meta_max ?? null,
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
    const prev = slot[input.kpi] || { valor_meta: 0, valor_realizado: 0 }
    slot[input.kpi] = {
      valor_meta: input.valor_meta,
      valor_realizado: input.valor_realizado ?? prev.valor_realizado ?? 0,
      valor_meta_min: input.valor_meta_min !== undefined ? input.valor_meta_min : prev.valor_meta_min ?? null,
      valor_meta_max: input.valor_meta_max !== undefined ? input.valor_meta_max : prev.valor_meta_max ?? null,
    }
    store[k] = slot
    escrever(store)
    return `mock-${k}-${input.kpi}`
  },
}
