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

export function trimestreRef(d: Date = new Date()): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

export function anoRef(d: Date = new Date()): string {
  return String(d.getFullYear());
}

export function refAtual(periodo: MetaPeriodo, d: Date = new Date()): string {
  if (periodo === 'semana')    return semanaRef(d);
  if (periodo === 'trimestre') return trimestreRef(d);
  return anoRef(d);
}

// Retorna [inicio, fim] do período corrente.
export function intervaloDoPeriodo(periodo: MetaPeriodo, d: Date = new Date()): [Date, Date] {
  if (periodo === 'semana') {
    const day = d.getDay() || 7; // domingo = 7
    const inicio = new Date(d); inicio.setHours(0, 0, 0, 0); inicio.setDate(d.getDate() - (day - 1));
    const fim = new Date(inicio); fim.setDate(inicio.getDate() + 6); fim.setHours(23, 59, 59, 999);
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
