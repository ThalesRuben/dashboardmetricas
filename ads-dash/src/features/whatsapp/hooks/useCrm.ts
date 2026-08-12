import { useCallback, useEffect, useState } from 'react';
import { crmRepo } from '../api/crmRepo';
import type {
  CrmNota,
  CrmTag,
  CrmFollowup,
  CrmFollowupComContato,
  CrmVenda,
  CrmSummary,
} from '../api/crmTypes';
import type { WhatsAppThreadStatusReal } from '../api/types';

// ============================================================
// Notas de uma thread
// ============================================================
export function useCrmNotas(threadId: string | null) {
  const [notas, setNotas] = useState<CrmNota[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!threadId) { setNotas([]); return; }
    setLoading(true);
    try { setNotas(await crmRepo.listarNotas(threadId)); }
    finally { setLoading(false); }
  }, [threadId]);

  useEffect(() => { refresh(); }, [refresh]);

  const criar = useCallback(async (texto: string) => {
    if (!threadId || !texto.trim()) return;
    const nova = await crmRepo.criarNota(threadId, texto.trim());
    setNotas(prev => [nova, ...prev]);
  }, [threadId]);

  const remover = useCallback(async (id: string) => {
    setNotas(prev => prev.filter(n => n.id !== id));
    await crmRepo.removerNota(id);
  }, []);

  return { notas, loading, criar, remover, refresh };
}

// ============================================================
// Tags globais + tags da thread ativa
// ============================================================
export function useCrmTags(threadId: string | null) {
  const [tagsGlobais, setTagsGlobais] = useState<CrmTag[]>([]);
  const [tagsDaThread, setTagsDaThread] = useState<CrmTag[]>([]);

  const refreshGlobais = useCallback(async () => {
    setTagsGlobais(await crmRepo.listarTags());
  }, []);

  const refreshDaThread = useCallback(async () => {
    if (!threadId) { setTagsDaThread([]); return; }
    setTagsDaThread(await crmRepo.tagsDaThread(threadId));
  }, [threadId]);

  useEffect(() => { refreshGlobais(); }, [refreshGlobais]);
  useEffect(() => { refreshDaThread(); }, [refreshDaThread]);

  const criarTag = useCallback(async (nome: string, cor?: string) => {
    const t = await crmRepo.criarTag(nome, cor);
    setTagsGlobais(prev => [...prev, t].sort((a, b) => a.nome.localeCompare(b.nome)));
    return t;
  }, []);

  const aplicar = useCallback(async (tagId: string) => {
    if (!threadId) return;
    await crmRepo.aplicarTag(threadId, tagId);
    await refreshDaThread();
  }, [threadId, refreshDaThread]);

  const remover = useCallback(async (tagId: string) => {
    if (!threadId) return;
    setTagsDaThread(prev => prev.filter(t => t.id !== tagId));
    await crmRepo.removerTagDaThread(threadId, tagId);
  }, [threadId]);

  return { tagsGlobais, tagsDaThread, criarTag, aplicar, remover, refresh: refreshDaThread };
}

// ============================================================
// Follow-ups pendentes (todos os threads) — usado na fila do dia
// ============================================================
export function useFollowupsPendentes() {
  const [followups, setFollowups] = useState<CrmFollowupComContato[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setFollowups(await crmRepo.listarFollowupsPendentes()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const marcarFeito = useCallback(async (id: string) => {
    setFollowups(prev => prev.filter(f => f.id !== id));
    await crmRepo.marcarFollowupFeito(id);
  }, []);

  return { followups, loading, marcarFeito, refresh };
}

// ============================================================
// Follow-ups de uma thread
// ============================================================
export function useCrmFollowups(threadId: string | null) {
  const [followups, setFollowups] = useState<CrmFollowup[]>([]);

  const refresh = useCallback(async () => {
    if (!threadId) { setFollowups([]); return; }
    setFollowups(await crmRepo.followupsDaThread(threadId));
  }, [threadId]);

  useEffect(() => { refresh(); }, [refresh]);

  const criar = useCallback(async (data: string, motivo?: string | null) => {
    if (!threadId) return;
    const f = await crmRepo.criarFollowup({ thread_id: threadId, data, motivo });
    setFollowups(prev => [...prev, f].sort((a, b) => (a.data < b.data ? -1 : 1)));
  }, [threadId]);

  const marcarFeito = useCallback(async (id: string) => {
    setFollowups(prev => prev.map(f => f.id === id ? { ...f, feito: true, feito_em: new Date().toISOString() } : f));
    await crmRepo.marcarFollowupFeito(id);
  }, []);

  const remover = useCallback(async (id: string) => {
    setFollowups(prev => prev.filter(f => f.id !== id));
    await crmRepo.removerFollowup(id);
  }, []);

  return { followups, criar, marcarFeito, remover, refresh };
}

// ============================================================
// Vendas de uma thread
// ============================================================
export function useCrmVendas(threadId: string | null) {
  const [vendas, setVendas] = useState<CrmVenda[]>([]);

  const refresh = useCallback(async () => {
    if (!threadId) { setVendas([]); return; }
    setVendas(await crmRepo.listarVendas(threadId));
  }, [threadId]);

  useEffect(() => { refresh(); }, [refresh]);

  const registrar = useCallback(async (input: { servico: string; valor_cents: number; data?: string; observacao?: string | null }) => {
    if (!threadId) return;
    const v = await crmRepo.registrarVenda({ thread_id: threadId, ...input });
    setVendas(prev => [v, ...prev]);
  }, [threadId]);

  const remover = useCallback(async (id: string) => {
    setVendas(prev => prev.filter(v => v.id !== id));
    await crmRepo.removerVenda(id);
  }, []);

  return { vendas, registrar, remover, refresh };
}

// ============================================================
// Resumo do CRM (KPIs do topo da aba)
// ============================================================
export function useCrmSummary(range?: { from: Date; to: Date } | null) {
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setSummary(await crmRepo.getSummary(range)); }
    finally { setLoading(false); }
  }, [range?.from?.getTime(), range?.to?.getTime()]);

  useEffect(() => { refresh(); }, [refresh]);

  return { summary, loading, refresh };
}

// ============================================================
// Ação de mudança de status (drag do kanban)
// ============================================================
export function useSetThreadStatus() {
  return useCallback(async (threadId: string, status: WhatsAppThreadStatusReal) => {
    await crmRepo.setStatus(threadId, status);
  }, []);
}
