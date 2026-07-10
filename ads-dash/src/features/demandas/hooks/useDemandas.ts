import { useCallback, useEffect, useMemo, useState } from 'react';
import { demandasRepo } from '../api/demandasRepo';
import type {
  Demanda,
  DemandaCreateInput,
  DemandaStatus,
  DemandaUpdateInput,
  TeamMember,
} from '../api/types';

export interface UseDemandasReturn {
  demandas: Demanda[];
  porStatus: Record<DemandaStatus, Demanda[]>;
  equipe: TeamMember[];
  loading: boolean;
  criar: (input: DemandaCreateInput) => Promise<void>;
  atualizar: (input: DemandaUpdateInput) => Promise<void>;
  remover: (id: string) => Promise<void>;
  moverPara: (id: string, status: DemandaStatus) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useDemandas(): UseDemandasReturn {
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [equipe, setEquipe] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, team] = await Promise.all([
        demandasRepo.listar(),
        demandasRepo.listarEquipe(),
      ]);
      setDemandas(list);
      setEquipe(team);
    } catch {
      setDemandas([]);
      setEquipe([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const criar = useCallback(async (input: DemandaCreateInput) => {
    await demandasRepo.criar(input);
    await refresh();
  }, [refresh]);

  const atualizar = useCallback(async (input: DemandaUpdateInput) => {
    setDemandas(prev => prev.map(d => d.id === input.id ? { ...d, ...input } as Demanda : d));
    try {
      await demandasRepo.atualizar(input);
    } finally {
      await refresh();
    }
  }, [refresh]);

  const remover = useCallback(async (id: string) => {
    setDemandas(prev => prev.filter(d => d.id !== id));
    try { await demandasRepo.remover(id); } finally { await refresh(); }
  }, [refresh]);

  const moverPara = useCallback(async (id: string, status: DemandaStatus) => {
    await atualizar({ id, status, ordem: Date.now() });
  }, [atualizar]);

  const porStatus = useMemo(() => {
    const buckets: Record<DemandaStatus, Demanda[]> = {
      backlog: [], fazendo: [], feito: [],
    };
    for (const d of demandas) buckets[d.status].push(d);

    // Backlog + fazendo: prazo asc (mais urgente no topo), sem prazo cai pro fim
    // e desempata por ordem manual. Feito: concluido_em desc (mais recente primeiro).
    const porPrazo = (a: Demanda, b: Demanda) => {
      if (a.prazo && b.prazo) {
        if (a.prazo !== b.prazo) return a.prazo < b.prazo ? -1 : 1;
        return a.ordem - b.ordem;
      }
      if (a.prazo) return -1;
      if (b.prazo) return 1;
      return a.ordem - b.ordem;
    };
    const porConclusao = (a: Demanda, b: Demanda) => {
      const ax = a.concluido_em ?? a.atualizado_em;
      const bx = b.concluido_em ?? b.atualizado_em;
      return ax < bx ? 1 : ax > bx ? -1 : 0;
    };

    buckets.backlog.sort(porPrazo);
    buckets.fazendo.sort(porPrazo);
    buckets.feito.sort(porConclusao);
    return buckets;
  }, [demandas]);

  return { demandas, porStatus, equipe, loading, criar, atualizar, remover, moverPara, refresh };
}
