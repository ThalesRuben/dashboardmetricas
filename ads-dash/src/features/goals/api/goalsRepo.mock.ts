// Implementação mock — metas trimestrais persistidas em localStorage.

import type { GoalsRepo } from './goalsRepo';
import type { Quarter } from './types';

const STORAGE_KEY = 'ads-dash:quarterly-goals';

const SEED: Quarter[] = [
  {
    q: 'Q1', label: '1º Trimestre', periodo: 'Jan – Mar 2026', status: 'fechado',
    metas: [
      { key: 'faturamento',  label: 'Faturamento',           meta: 180000, realizado: 172400, unidade: 'BRL' },
      { key: 'clientes',     label: 'Novos clientes',        meta: 220,    realizado: 238,    unidade: 'num' },
      { key: 'roas',         label: 'ROAS médio',            meta: 4,      realizado: 4.3,    unidade: 'x'   },
      { key: 'seguidores',   label: 'Seguidores Instagram',  meta: 14000,  realizado: 14180,  unidade: 'num' },
    ],
  },
  {
    q: 'Q2', label: '2º Trimestre', periodo: 'Abr – Jun 2026', status: 'andamento',
    metas: [
      { key: 'faturamento',  label: 'Faturamento',           meta: 210000, realizado: 134800, unidade: 'BRL' },
      { key: 'clientes',     label: 'Novos clientes',        meta: 260,    realizado: 151,    unidade: 'num' },
      { key: 'roas',         label: 'ROAS médio',            meta: 4.5,    realizado: 4.1,    unidade: 'x'   },
      { key: 'seguidores',   label: 'Seguidores Instagram',  meta: 17000,  realizado: 15600,  unidade: 'num' },
      { key: 'agendamentos', label: 'Agendamentos via Ads',  meta: 540,    realizado: 312,    unidade: 'num' },
    ],
  },
  {
    q: 'Q3', label: '3º Trimestre', periodo: 'Jul – Set 2026', status: 'futuro',
    metas: [
      { key: 'faturamento',  label: 'Faturamento',           meta: 240000, realizado: 0, unidade: 'BRL' },
      { key: 'clientes',     label: 'Novos clientes',        meta: 300,    realizado: 0, unidade: 'num' },
      { key: 'roas',         label: 'ROAS médio',            meta: 4.8,    realizado: 0, unidade: 'x'   },
      { key: 'seguidores',   label: 'Seguidores Instagram',  meta: 21000,  realizado: 0, unidade: 'num' },
    ],
  },
  {
    q: 'Q4', label: '4º Trimestre', periodo: 'Out – Dez 2026', status: 'futuro',
    metas: [
      { key: 'faturamento',  label: 'Faturamento',           meta: 300000, realizado: 0, unidade: 'BRL' },
      { key: 'clientes',     label: 'Novos clientes',        meta: 360,    realizado: 0, unidade: 'num' },
      { key: 'roas',         label: 'ROAS médio',            meta: 5,      realizado: 0, unidade: 'x'   },
      { key: 'seguidores',   label: 'Seguidores Instagram',  meta: 26000,  realizado: 0, unidade: 'num' },
    ],
  },
];

function load(): Quarter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Quarter[]) : SEED;
  } catch { return SEED; }
}

export const mockGoalsRepo: GoalsRepo = {
  async list() {
    return load();
  },
  saveLocal(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  },
};

export { SEED as MOCK_GOALS, STORAGE_KEY as GOALS_STORAGE_KEY };
