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
    for (const k of Object.keys(buckets) as DemandaStatus[]) {
      buckets[k].sort((a, b) => a.ordem - b.ordem);
    }
    return buckets;
  }, [demandas]);

  return { demandas, porStatus, equipe, loading, criar, atualizar, remover, moverPara, refresh };
}
