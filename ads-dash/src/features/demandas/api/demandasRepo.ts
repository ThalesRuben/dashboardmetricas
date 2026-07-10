import { createRepo } from '@/shared/lib/api/createRepo';
import { mockDemandasRepo } from './demandasRepo.mock';
import { supabaseDemandasRepo } from './demandasRepo.supabase';
import type {
  Demanda,
  DemandaComentario,
  DemandaCreateInput,
  DemandaUpdateInput,
  TeamMember,
} from './types';

export interface DemandasRepo {
  listar(): Promise<Demanda[]>;
  criar(input: DemandaCreateInput): Promise<Demanda>;
  atualizar(input: DemandaUpdateInput): Promise<void>;
  remover(id: string): Promise<void>;
  listarEquipe(): Promise<TeamMember[]>;
  listarComentarios(demandaId: string): Promise<DemandaComentario[]>;
  criarComentario(input: { demanda_id: string; texto: string }): Promise<DemandaComentario>;
  removerComentario(id: string): Promise<void>;
}

export const demandasRepo: DemandasRepo = createRepo<DemandasRepo>({
  mock: mockDemandasRepo,
  supabase: supabaseDemandasRepo,
});
