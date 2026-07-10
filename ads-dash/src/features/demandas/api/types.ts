export type DemandaStatus = 'backlog' | 'fazendo' | 'feito';
export type DemandaPrioridade = 'baixa' | 'media' | 'alta';

export interface Demanda {
  id: string;
  titulo: string;
  descricao: string | null;
  status: DemandaStatus;
  prioridade: DemandaPrioridade;
  ordem: number;
  criado_por: string | null;
  responsavel_id: string | null;
  criado_em: string;
  atualizado_em: string;
  concluido_em: string | null;
}

export interface DemandaCreateInput {
  titulo: string;
  descricao?: string | null;
  status?: DemandaStatus;
  prioridade?: DemandaPrioridade;
  responsavel_id?: string | null;
}

export interface DemandaUpdateInput {
  id: string;
  titulo?: string;
  descricao?: string | null;
  status?: DemandaStatus;
  prioridade?: DemandaPrioridade;
  ordem?: number;
  responsavel_id?: string | null;
}

export interface TeamMember {
  id: string;
  full_name: string;
}

export type DemandaFiltro =
  | { tipo: 'todas' }
  | { tipo: 'minhas' }
  | { tipo: 'pessoa'; pessoaId: string };

export const STATUS_LABELS: Record<DemandaStatus, string> = {
  backlog: 'Backlog',
  fazendo: 'Fazendo',
  feito:   'Feito',
};

export const PRIORIDADE_LABELS: Record<DemandaPrioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta:  'Alta',
};
