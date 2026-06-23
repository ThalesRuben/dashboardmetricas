// Tipos públicos da feature `metas` — metas por KPI × período.

export type MetaPeriodo = 'semana' | 'trimestre' | 'ano';
export type MetaUnidade = 'BRL' | 'num' | 'x' | '%';

export interface MetaKpi {
  id: string;
  kpi: string;
  label: string | null;
  unidade: MetaUnidade;
  ordem: number;
  valor_meta: number;
  valor_realizado: number;
}

export interface KpiDef {
  kpi: string;
  label: string;
  unidade: MetaUnidade;
  ordem: number;
  // true = realizado é computado automaticamente no banco (RPC); user só define a meta.
  // false = realizado é manual (user atualiza pelo Settings).
  auto: boolean;
}

// Catálogo de KPIs que podem virar meta. Edite aqui pra adicionar/remover.
export const KPIS_PADRAO: KpiDef[] = [
  { kpi: 'faturamento',         label: 'Faturamento',          unidade: 'BRL', ordem: 1, auto: false },
  { kpi: 'conversas_whatsapp',  label: 'Conversas WhatsApp',   unidade: 'num', ordem: 2, auto: true  },
  { kpi: 'leads',               label: 'Leads',                unidade: 'num', ordem: 3, auto: true  },
  { kpi: 'agendamentos',        label: 'Agendamentos',         unidade: 'num', ordem: 4, auto: true  },
  { kpi: 'vendas',              label: 'Vendas',               unidade: 'num', ordem: 5, auto: true  },
  { kpi: 'investimento_ads',    label: 'Investimento em Ads',  unidade: 'BRL', ordem: 6, auto: false },
  { kpi: 'roas_medio',          label: 'ROAS médio',           unidade: 'x',   ordem: 7, auto: false },
];

export interface MetaUpsertInput {
  kpi: string;
  periodo: MetaPeriodo;
  periodo_ref: string;
  valor_meta: number;
  valor_realizado?: number;
  unidade: MetaUnidade;
  label: string;
  ordem: number;
}
