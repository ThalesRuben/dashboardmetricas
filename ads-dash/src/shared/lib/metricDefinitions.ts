// Definições e explicações por métrica — alimentam o MetricExplainer
// ("Why this metric?") e o drill-down (lista de itens por trás do número).

import { fmtBRL, fmtNumber, fmtPct, fmtRoas } from './format';

export interface MetricSummary {
  roas?: number;
  roi?: number;
  ctrMeta?: number;
  ctrGoogle?: number;
  mensagens?: number;
  agendamentos?: number;
  vendas?: number;
  investido?: number;
  receita?: number;
  cliques?: number;
  impressoes?: number;
}

export interface MetricDriver {
  label: string;
  value: string;
}

export interface MetricDrillItem {
  titulo: string;
  sub: string;
  tag: string;
}

interface MetricDef {
  label: string;
  definicao: string;
  formula: string;
  meta: number | null;
  metaLabel: string;
  fmt: (v: number) => string;
  pickValue: (s?: MetricSummary) => number;
  drivers: (s?: MetricSummary) => MetricDriver[];
  drill?: () => MetricDrillItem[];
}

const DEFS: Record<string, MetricDef> = {
  roas: {
    label: 'ROAS',
    definicao: 'Retorno sobre o investimento em ads. Quanto você fatura para cada R$ 1 gasto em mídia.',
    formula: 'ROAS = Receita / Investimento',
    meta: 4,
    metaLabel: '4x (bom) · 6x+ (excelente)',
    fmt: fmtRoas,
    pickValue: (s) => s?.roas ?? 0,
    drivers: (s) => [
      { label: 'Receita', value: fmtBRL(s?.receita || 0) },
      { label: 'Investimento', value: fmtBRL(s?.investido || 0) },
      { label: 'Ticket médio', value: s?.vendas ? fmtBRL((s.receita || 0) / s.vendas) : '—' },
    ],
  },
  roi: {
    label: 'ROI',
    definicao: 'Retorno percentual sobre o investimento. ROI = 100% significa que você dobrou o dinheiro.',
    formula: 'ROI = (Receita - Investimento) / Investimento',
    meta: 200,
    metaLabel: '200% (sólido)',
    fmt: (v) => `${v}%`,
    pickValue: (s) => s?.roi ?? 0,
    drivers: (s) => [
      { label: 'Receita', value: fmtBRL(s?.receita || 0) },
      { label: 'Gasto', value: fmtBRL(s?.investido || 0) },
      { label: 'Lucro bruto', value: fmtBRL((s?.receita || 0) - (s?.investido || 0)) },
    ],
  },
  ctrMeta: {
    label: 'CTR Meta',
    definicao: 'Taxa de clique no anúncio do Facebook/Instagram. Mede se o criativo prende a atenção.',
    formula: 'CTR = Cliques / Impressões',
    meta: 2.5,
    metaLabel: '2,5% (mínimo) · 4%+ (forte)',
    fmt: (v) => fmtPct(v, 2),
    pickValue: (s) => s?.ctrMeta ?? 0,
    drivers: (s) => [
      { label: 'Cliques (período)', value: fmtNumber(s?.cliques || 0) },
      { label: 'Impressões (período)', value: fmtNumber(s?.impressoes || 0) },
    ],
  },
  ctrGoogle: {
    label: 'CTR Google',
    definicao: 'Taxa de clique nos anúncios de busca do Google. Aqui CTR alto = intenção alta.',
    formula: 'CTR = Cliques / Impressões',
    meta: 5,
    metaLabel: '5% (forte em busca)',
    fmt: (v) => fmtPct(v, 2),
    pickValue: (s) => s?.ctrGoogle ?? 0,
    drivers: (s) => [
      { label: 'Cliques (período)', value: fmtNumber(s?.cliques || 0) },
      { label: 'Impressões (período)', value: fmtNumber(s?.impressoes || 0) },
    ],
  },
  mensagens: {
    label: 'Mensagens',
    definicao: 'Mensagens recebidas no WhatsApp originadas pelos anúncios CTWA (Click-to-WhatsApp) e canais orgânicos.',
    formula: 'Soma de conversas iniciadas no período',
    meta: null,
    metaLabel: '',
    fmt: fmtNumber,
    pickValue: (s) => s?.mensagens ?? 0,
    drivers: (s) => [
      { label: 'Cliques no anúncio CTWA', value: fmtNumber(Math.round((s?.cliques || 0) * 0.4)) },
      { label: 'Conversão clique→msg', value: '~25%' },
    ],
    drill: () => [
      { titulo: 'Marina Alves', sub: 'Quer agendar mechas', tag: 'Anúncio Meta' },
      { titulo: 'Patrícia Gomes', sub: 'Preço progressiva', tag: 'Instagram' },
      { titulo: 'Júlia Ramos', sub: 'Confirmou horário', tag: 'Anúncio Meta' },
      { titulo: 'Carla Souza', sub: 'Reagendou corte', tag: 'Google' },
      { titulo: 'Bianca Lima', sub: 'Fechou pacote noiva', tag: 'Indicação' },
    ],
  },
  agendamentos: {
    label: 'Agendamentos',
    definicao: 'Horários efetivamente marcados na agenda. Métrica mais próxima de receita real.',
    formula: 'Mensagens × taxa de conversão para agenda',
    meta: null,
    metaLabel: '',
    fmt: fmtNumber,
    pickValue: (s) => s?.agendamentos ?? 0,
    drivers: (s) => [
      { label: 'Mensagens', value: fmtNumber(s?.mensagens || 0) },
      {
        label: 'Conversão msg→agenda',
        value: s?.mensagens ? `${Math.round(((s.agendamentos || 0) / s.mensagens) * 100)}%` : '—',
      },
    ],
    drill: () => [
      { titulo: 'Bianca Lima', sub: 'Pacote noiva · qui 14h', tag: 'CTWA' },
      { titulo: 'Júlia Ramos', sub: 'Mechas · qui 15h', tag: 'CTWA' },
      { titulo: 'Ana Pereira', sub: 'Progressiva · sex 10h', tag: 'Instagram' },
      { titulo: 'Camila Vieira', sub: 'Corte + escova · sex 14h', tag: 'Google' },
    ],
  },
  vendas: {
    label: 'Vendas',
    definicao: 'Serviços efetivamente fechados (após o atendimento). É o último passo do funil.',
    formula: 'Agendamentos × taxa de conversão para venda',
    meta: null,
    metaLabel: '',
    fmt: fmtNumber,
    pickValue: (s) => s?.vendas ?? 0,
    drivers: (s) => [
      { label: 'Agendamentos', value: fmtNumber(s?.agendamentos || 0) },
      {
        label: 'Conversão agenda→venda',
        value: s?.agendamentos ? `${Math.round(((s.vendas || 0) / s.agendamentos) * 100)}%` : '—',
      },
      { label: 'Receita gerada', value: fmtBRL(s?.receita || 0) },
    ],
  },
  investido: {
    label: 'Investimento',
    definicao: 'Total gasto em mídia paga (Meta Ads + Google Ads) no período.',
    formula: 'Soma diária do gasto em todas as plataformas',
    meta: null,
    metaLabel: '',
    fmt: fmtBRL,
    pickValue: (s) => s?.investido ?? 0,
    drivers: (s) => [
      { label: 'Meta Ads (estim.)', value: fmtBRL((s?.investido || 0) * 0.65) },
      { label: 'Google Ads (estim.)', value: fmtBRL((s?.investido || 0) * 0.35) },
    ],
  },
};

function pctDelta(c: number, p: number): number | null {
  if (!p) return null;
  return +(((c - p) / p) * 100).toFixed(1);
}

export interface MetricExplain {
  key: string;
  label: string;
  definicao: string;
  formula: string;
  meta: number | null;
  metaLabel: string;
  valor: string;
  valorAnterior: string;
  delta: number | null;
  serie: number[];
  drivers: MetricDriver[];
  drillItems: MetricDrillItem[] | null;
  aboveTarget: boolean | null;
}

export interface BuildMetricExplainInput {
  summary?: MetricSummary;
  prev?: MetricSummary;
  days?: ReadonlyArray<Record<string, unknown> | object>;
}

export function buildMetricExplain(
  key: string,
  { summary, prev, days }: BuildMetricExplainInput,
): MetricExplain | null {
  const def = DEFS[key];
  if (!def) return null;
  const curr = def.pickValue(summary);
  const previous = def.pickValue(prev);
  const delta = pctDelta(curr, previous);
  const serie = (days || []).map((d) => Number((d as Record<string, unknown>)[key]) || 0);
  const drillItems = def.drill ? def.drill() : null;
  return {
    key,
    label: def.label,
    definicao: def.definicao,
    formula: def.formula,
    meta: def.meta,
    metaLabel: def.metaLabel,
    valor: def.fmt(curr),
    valorAnterior: def.fmt(previous),
    delta,
    serie,
    drivers: def.drivers(summary),
    drillItems,
    aboveTarget: def.meta != null ? curr >= def.meta : null,
  };
}

export const EXPLAINABLE_KEYS = Object.keys(DEFS);
