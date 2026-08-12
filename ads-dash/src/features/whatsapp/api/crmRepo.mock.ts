// Stub em memória — apenas pra o app não quebrar em VITE_DATA_SOURCE=mock.
// Sem persistência entre reloads.

import type { CrmRepo } from './crmRepo';
import type {
  CrmNota,
  CrmTag,
  CrmFollowup,
  CrmFollowupComContato,
  CrmVenda,
  CrmSummary,
} from './crmTypes';

const notas: CrmNota[] = [];
const tags: CrmTag[] = [
  { id: 't1', nome: 'VIP', cor: '#e07bff' },
  { id: 't2', nome: 'Corte', cor: '#5dcaa5' },
  { id: 't3', nome: 'Coloração', cor: '#f6b93b' },
];
const threadTags = new Map<string, Set<string>>();
const followups: CrmFollowup[] = [];
const vendas: CrmVenda[] = [];

function uid() { return Math.random().toString(36).slice(2, 12); }

export const mockCrmRepo: CrmRepo = {
  async listarNotas(threadId) {
    return notas.filter(n => n.thread_id === threadId);
  },
  async criarNota(threadId, texto) {
    const n: CrmNota = { id: uid(), thread_id: threadId, autor_id: null, texto, criado_em: new Date().toISOString() };
    notas.unshift(n);
    return n;
  },
  async removerNota(id) {
    const i = notas.findIndex(n => n.id === id);
    if (i >= 0) notas.splice(i, 1);
  },

  async listarTags() { return [...tags]; },
  async criarTag(nome, cor = '#5dcaa5') {
    const t: CrmTag = { id: uid(), nome, cor };
    tags.push(t);
    return t;
  },
  async removerTag(id) {
    const i = tags.findIndex(t => t.id === id);
    if (i >= 0) tags.splice(i, 1);
    for (const set of threadTags.values()) set.delete(id);
  },
  async tagsDaThread(threadId) {
    const set = threadTags.get(threadId);
    if (!set) return [];
    return tags.filter(t => set.has(t.id));
  },
  async aplicarTag(threadId, tagId) {
    const set = threadTags.get(threadId) ?? new Set();
    set.add(tagId);
    threadTags.set(threadId, set);
  },
  async removerTagDaThread(threadId, tagId) {
    threadTags.get(threadId)?.delete(tagId);
  },

  async listarFollowupsPendentes(): Promise<CrmFollowupComContato[]> {
    return followups
      .filter(f => !f.feito)
      .map(f => ({ ...f, contato_nome: null, contato_phone: '', thread_status: 'aberta' }));
  },
  async followupsDaThread(threadId) {
    return followups.filter(f => f.thread_id === threadId);
  },
  async criarFollowup(input) {
    const f: CrmFollowup = {
      id: uid(),
      thread_id: input.thread_id,
      responsavel_id: null,
      data: input.data,
      motivo: input.motivo ?? null,
      feito: false,
      feito_em: null,
      criado_em: new Date().toISOString(),
    };
    followups.push(f);
    return f;
  },
  async marcarFollowupFeito(id) {
    const f = followups.find(x => x.id === id);
    if (f) { f.feito = true; f.feito_em = new Date().toISOString(); }
  },
  async removerFollowup(id) {
    const i = followups.findIndex(f => f.id === id);
    if (i >= 0) followups.splice(i, 1);
  },

  async listarVendas(threadId) {
    return vendas.filter(v => v.thread_id === threadId);
  },
  async registrarVenda(input) {
    const v: CrmVenda = {
      id: uid(),
      thread_id: input.thread_id,
      registrado_por: null,
      servico: input.servico,
      valor_cents: input.valor_cents,
      data: input.data ?? new Date().toISOString().slice(0, 10),
      observacao: input.observacao ?? null,
      criado_em: new Date().toISOString(),
    };
    vendas.push(v);
    return v;
  },
  async removerVenda(id) {
    const i = vendas.findIndex(v => v.id === id);
    if (i >= 0) vendas.splice(i, 1);
  },

  async setStatus() { /* noop */ },

  async getSummary(): Promise<CrmSummary> {
    const total = vendas.reduce((a, v) => a + v.valor_cents, 0);
    return {
      leads: 0, em_atendimento: 0, agendados: 0,
      vendas_qtd: vendas.length,
      vendas_valor_cents: total,
      ticket_medio_cents: vendas.length ? Math.round(total / vendas.length) : 0,
      followups_pendentes: followups.filter(f => !f.feito).length,
      followups_atrasados: followups.filter(f => !f.feito && new Date(f.data) < new Date()).length,
    };
  },
};
