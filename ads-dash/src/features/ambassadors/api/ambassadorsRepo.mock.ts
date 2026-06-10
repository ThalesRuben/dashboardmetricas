// Implementação mock — embaixadores e influenciadores persistidos em localStorage.

import type { AmbassadorsRepo } from './ambassadorsRepo';
import type { Ambassador, AmbassadorPayload } from './types';

const STORAGE_KEY = 'ads-dash:ambassadors';

const SEED: Ambassador[] = [
  { id: 'a1', nome: 'Larissa Mendes', handle: '@larimendes', plataforma: 'Instagram', tipo: 'embaixador',
    seguidores: 48200, engajamento: 6.4, status: 'ativo', cupom: 'LARI15',
    cliques: 1840, vendas_atribuidas: 38, receita_atribuida: 9120, comissao_pct: 12, ultimo_post: '2026-05-16' },
  { id: 'a2', nome: 'Bruna Castro', handle: '@brucastro.beauty', plataforma: 'TikTok', tipo: 'influenciador',
    seguidores: 132000, engajamento: 9.1, status: 'ativo', cupom: 'BRUNA20',
    cliques: 4210, vendas_atribuidas: 71, receita_atribuida: 18460, comissao_pct: 15, ultimo_post: '2026-05-18' },
  { id: 'a3', nome: 'Camila Rocha', handle: '@camirocha', plataforma: 'Instagram', tipo: 'micro',
    seguidores: 8600, engajamento: 11.2, status: 'ativo', cupom: 'CAMI10',
    cliques: 640, vendas_atribuidas: 19, receita_atribuida: 4180, comissao_pct: 10, ultimo_post: '2026-05-12' },
  { id: 'a4', nome: 'Yasmin Oliveira', handle: '@yasminoliveira', plataforma: 'YouTube', tipo: 'influenciador',
    seguidores: 64000, engajamento: 4.8, status: 'negociando', cupom: '',
    cliques: 0, vendas_atribuidas: 0, receita_atribuida: 0, comissao_pct: 0, ultimo_post: null },
  { id: 'a5', nome: 'Fernanda Dias', handle: '@fefedias', plataforma: 'Instagram', tipo: 'cliente-vip',
    seguidores: 3200, engajamento: 7.6, status: 'pausado', cupom: 'FE5',
    cliques: 210, vendas_atribuidas: 6, receita_atribuida: 1320, comissao_pct: 8, ultimo_post: '2026-04-28' },
];

function load(): Ambassador[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Ambassador[]) : SEED;
  } catch { return SEED; }
}
function save(list: Ambassador[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function toAmbassador(payload: AmbassadorPayload): Ambassador {
  return {
    id: 'a' + Date.now(),
    nome: payload.nome,
    handle: payload.handle,
    plataforma: payload.plataforma || 'Instagram',
    tipo: payload.tipo || 'micro',
    seguidores: Number(payload.seguidores) || 0,
    engajamento: Number(payload.engajamento) || 0,
    status: payload.status || 'negociando',
    cupom: payload.cupom || '',
    cliques: 0,
    vendas_atribuidas: 0,
    receita_atribuida: 0,
    comissao_pct: Number(payload.comissao_pct) || 0,
    ultimo_post: null,
  };
}

export const mockAmbassadorsRepo: AmbassadorsRepo = {
  async list() {
    return load();
  },
  async add(payload) {
    const next = [...load(), toAmbassador(payload)];
    save(next);
    return { data: next[next.length - 1], error: null };
  },
  async remove(id) {
    save(load().filter(a => a.id !== id));
    return { error: null };
  },
};

export { toAmbassador as buildAmbassador };
