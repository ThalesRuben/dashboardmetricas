// Helpers de período (semana ISO, trimestre, ano) — refs canônicos e
// frações de tempo decorrido pra calcular "no ritmo / atrasado".

import type { MetaPeriodo } from '../api/types';

// Semana ISO 8601: segunda a domingo. Ref no formato '2026-W26'.
export function semanaRef(d: Date = new Date()): string {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function mesRef(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function trimestreRef(d: Date = new Date()): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

export function anoRef(d: Date = new Date()): string {
  return String(d.getFullYear());
}

export function refAtual(periodo: MetaPeriodo, d: Date = new Date()): string {
  if (periodo === 'semana')    return semanaRef(d);
  if (periodo === 'mes')       return mesRef(d);
  if (periodo === 'trimestre') return trimestreRef(d);
  return anoRef(d);
}

// Dado um trimestreRef ('2026-Q2'), retorna os 3 mesRef ('2026-04', '2026-05', '2026-06').
export function mesesDoTrimestre(qRef: string): string[] {
  const [ano, q] = qRef.split('-Q');
  const base = (Number(q) - 1) * 3 + 1;
  return [0, 1, 2].map(i => `${ano}-${String(base + i).padStart(2, '0')}`);
}

// Dado um ano ('2026'), retorna os 4 trimestreRef.
export function trimestresDoAno(anoRefStr: string): string[] {
  return [1, 2, 3, 4].map(q => `${anoRefStr}-Q${q}`);
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function rotuloMes(ref: string): string {
  const [ano, mes] = ref.split('-');
  return `${MESES_PT[Number(mes) - 1]}/${ano.slice(2)}`;
}

// Retorna [inicio, fim] do período corrente.
export function intervaloDoPeriodo(periodo: MetaPeriodo, d: Date = new Date()): [Date, Date] {
  if (periodo === 'semana') {
    const day = d.getDay() || 7; // domingo = 7
    const inicio = new Date(d); inicio.setHours(0, 0, 0, 0); inicio.setDate(d.getDate() - (day - 1));
    const fim = new Date(inicio); fim.setDate(inicio.getDate() + 6); fim.setHours(23, 59, 59, 999);
    return [inicio, fim];
  }
  if (periodo === 'mes') {
    const inicio = new Date(d.getFullYear(), d.getMonth(), 1);
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return [inicio, fim];
  }
  if (periodo === 'trimestre') {
    const q = Math.floor(d.getMonth() / 3);
    const inicio = new Date(d.getFullYear(), q * 3, 1);
    const fim = new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
    return [inicio, fim];
  }
  const inicio = new Date(d.getFullYear(), 0, 1);
  const fim = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
  return [inicio, fim];
}

// Fração 0..1 do período já decorrida. Usado pra decidir se uma meta
// está adiantada/no ritmo/atrasada.
export function progressoTempo(periodo: MetaPeriodo, d: Date = new Date()): number {
  const [inicio, fim] = intervaloDoPeriodo(periodo, d);
  const total = fim.getTime() - inicio.getTime();
  const decorrido = d.getTime() - inicio.getTime();
  return Math.max(0, Math.min(1, decorrido / total));
}

// Mesma ideia, mas pra um periodoRef específico (não o corrente). Útil pra
// mostrar Q1 fechado (1.0) ou Q3 futuro (0).
export function progressoTempoRef(periodo: MetaPeriodo, periodoRef: string, d: Date = new Date()): number {
  const [inicio, fim] = janelaDoRef(periodo, periodoRef);
  if (!inicio || !fim) return 0;
  if (d.getTime() <= inicio.getTime()) return 0;
  if (d.getTime() >= fim.getTime()) return 1;
  return (d.getTime() - inicio.getTime()) / (fim.getTime() - inicio.getTime());
}

export function janelaDoRef(periodo: MetaPeriodo, periodoRef: string): [Date | null, Date | null] {
  if (periodo === 'ano') {
    const ano = Number(periodoRef);
    if (!ano) return [null, null];
    return [new Date(ano, 0, 1), new Date(ano + 1, 0, 1)];
  }
  if (periodo === 'trimestre') {
    const [a, q] = periodoRef.split('-Q');
    const ano = Number(a); const qq = Number(q);
    if (!ano || !qq) return [null, null];
    return [new Date(ano, (qq - 1) * 3, 1), new Date(ano, qq * 3, 1)];
  }
  if (periodo === 'mes') {
    const [a, m] = periodoRef.split('-');
    const ano = Number(a); const mes = Number(m);
    if (!ano || !mes) return [null, null];
    return [new Date(ano, mes - 1, 1), new Date(ano, mes, 1)];
  }
  // semana
  const [a, w] = periodoRef.split('-W');
  const ano = Number(a); const ww = Number(w);
  if (!ano || !ww) return [null, null];
  const jan4 = new Date(ano, 0, 4);
  const dow = jan4.getDay() || 7;
  const seg1 = new Date(jan4); seg1.setDate(jan4.getDate() - (dow - 1));
  const inicio = new Date(seg1); inicio.setDate(seg1.getDate() + (ww - 1) * 7);
  const fim = new Date(inicio); fim.setDate(inicio.getDate() + 7);
  return [inicio, fim];
}

export function diasRestantes(periodo: MetaPeriodo, d: Date = new Date()): number {
  const [, fim] = intervaloDoPeriodo(periodo, d);
  return Math.max(0, Math.ceil((fim.getTime() - d.getTime()) / 86_400_000));
}

export function rotuloPeriodo(periodo: MetaPeriodo, ref: string): string {
  if (periodo === 'ano') return ref;
  if (periodo === 'trimestre') {
    const [ano, q] = ref.split('-Q');
    const meses = q === '1' ? 'Jan–Mar' : q === '2' ? 'Abr–Jun' : q === '3' ? 'Jul–Set' : 'Out–Dez';
    return `${q}º trimestre · ${meses} ${ano}`;
  }
  if (periodo === 'mes') {
    const [ano, mes] = ref.split('-');
    const nome = MESES_PT[Number(mes) - 1] || ref;
    return `${nome} ${ano}`;
  }
  // semana
  const [ano, w] = ref.split('-W');
  return `Semana ${w} de ${ano}`;
}

// Veredito visual baseado em quanto da meta foi atingido vs. quanto do tempo passou.
export type Veredito = 'adiantado' | 'no-ritmo' | 'atrasado' | 'batida' | 'sem-meta';

export function veredito(pct: number, tempo: number, valorMeta: number): Veredito {
  if (valorMeta === 0) return 'sem-meta';
  const r = pct / 100;
  if (r >= 1) return 'batida';
  if (r >= tempo + 0.05) return 'adiantado';
  if (r <= tempo - 0.08) return 'atrasado';
  return 'no-ritmo';
}

// Veredito por cenário (mín / base / máx). Diferente do `veredito` legado:
// foca em qual patamar foi atingido, não em ritmo×tempo.
export type VereditoCenario = 'superou' | 'no-plano' | 'piso-ok' | 'abaixo-piso' | 'no-inicio' | 'sem-meta';

export interface MetaCenarios {
  min: number | null;
  base: number;
  max: number | null;
}

export function vereditoCenario(realizado: number, c: MetaCenarios, tempo: number): VereditoCenario {
  const temAlgumaMeta = (c.base || 0) > 0 || (c.min ?? 0) > 0 || (c.max ?? 0) > 0;
  if (!temAlgumaMeta) return 'sem-meta';
  if (tempo <= 0 && realizado === 0) return 'no-inicio';
  const max = c.max ?? c.base;
  const base = c.base;
  const min = c.min ?? c.base;
  if (max && realizado >= max) return 'superou';
  if (base && realizado >= base) return 'no-plano';
  if (min && realizado >= min) return 'piso-ok';
  return 'abaixo-piso';
}

// Quanto falta pra cada cenário. Negativo = sobra. null = não há meta nesse cenário.
export interface FaltaCenarios {
  min: number | null;
  base: number | null;
  max: number | null;
}

export function quantoFalta(realizado: number, c: MetaCenarios): FaltaCenarios {
  return {
    min:  c.min  != null ? c.min  - realizado : null,
    base: c.base > 0     ? c.base - realizado : null,
    max:  c.max  != null ? c.max  - realizado : null,
  };
}
