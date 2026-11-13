import { useCallback, useEffect, useState } from 'react';
import { coachRascunhosRepo, type CoachRascunho } from '../api/coachRascunhosRepo';

export interface UseCoachRascunhosReturn {
  rascunhos: CoachRascunho[];
  loading: boolean;
  erro: string | null;
  recarregar: () => Promise<void>;
  removerLocal: (id: string) => void;
}

export function useCoachRascunhos(): UseCoachRascunhosReturn {
  const [rascunhos, setRascunhos] = useState<CoachRascunho[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const lista = await coachRascunhosRepo.listarPendentes();
      setRascunhos(lista);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar rascunhos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  function removerLocal(id: string) {
    setRascunhos((prev) => prev.filter((r) => r.id !== id));
  }

  return { rascunhos, loading, erro, recarregar, removerLocal };
}
