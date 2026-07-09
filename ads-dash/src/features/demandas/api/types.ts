export type DemandaStatus = 'backlog' | 'fazendo' | 'feito';
export type DemandaPrioridade = 'baixa' | 'media' | 'alta';

export interface Demanda {
  id: string;
  titulo: string;
  descricao: string | null;
  status: DemandaStatus;
  prioridade: DemandaPrioridade;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export interface DemandaCreateInput {
  titulo: string;
  descricao?: string | null;
  status?: DemandaStatus;
  prioridade?: DemandaPrioridade;
}

export interface DemandaUpdateInput {
  id: string;
  titulo?: string;
  descricao?: string | null;
  status?: DemandaStatus;
  prioridade?: DemandaPrioridade;
  ordem?: number;
}

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
