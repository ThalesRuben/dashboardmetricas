import { createRepo } from '@/shared/lib/api/createRepo';
import { mockDemandasRepo } from './demandasRepo.mock';
import { supabaseDemandasRepo } from './demandasRepo.supabase';
import type {
  Demanda,
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
}

export const demandasRepo: DemandasRepo = createRepo<DemandasRepo>({
  mock: mockDemandasRepo,
  supabase: supabaseDemandasRepo,
});
