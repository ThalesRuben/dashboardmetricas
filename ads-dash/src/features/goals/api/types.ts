// Tipos públicos da feature `goals` — metas trimestrais.

export type QuarterStatus = 'fechado' | 'andamento' | 'futuro';
export type QuarterKey = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type MetaUnidade = 'BRL' | 'num' | 'x' | '%';

export interface QuarterMeta {
  key: string;
  label: string;
  meta: number;
  realizado: number;
  unidade: MetaUnidade;
}

export interface Quarter {
  q: QuarterKey;
  label: string;
  periodo: string;
  status: QuarterStatus;
  metas: QuarterMeta[];
}

export interface MetaPatch {
  meta?: number;
  realizado?: number;
  label?: string;
  unidade?: MetaUnidade;
}
