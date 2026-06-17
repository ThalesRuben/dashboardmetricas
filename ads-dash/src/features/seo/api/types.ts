// Tipos públicos da feature `seo`.

export type SeoDificuldade = 'baixa' | 'média' | 'alta';
export type SeoOportunidade = 'baixa' | 'média' | 'alta';
export type SeoPrioridade = 'baixa' | 'média' | 'alta';
export type SeoStatus = 'ok' | 'alerta' | 'erro';
export type SeoIntent = 'informacional' | 'comercial' | 'transacional' | 'navegacional' | 'local';

export interface SeoResumo {
  keywords_monitoradas: number;
  no_top10: number;
  trafego_organico_mes: number;
  trafego_delta: number;
}

export interface SeoKeyword {
  termo: string;
  posicao: number;
  posicao_anterior: number;
  volume: number;
  dificuldade: SeoDificuldade;
  oportunidade: SeoOportunidade;
}

export interface SeoSugestao {
  titulo: string;
  tipo: string;
  prioridade: SeoPrioridade;
  descricao: string;
}

export interface SeoAuditoriaItem {
  item: string;
  status: SeoStatus;
  nota: string;
}

export interface SeoSnapshot {
  score: number;
  score_delta: number;
  resumo: SeoResumo;
  keywords: SeoKeyword[];
  sugestoes: SeoSugestao[];
  auditoria: SeoAuditoriaItem[];
}

export interface SeoKeywordIdea {
  termo: string;
  volume: number;
  dificuldade: SeoDificuldade;
  intent: SeoIntent;
}

export interface SeoKeywordResearch {
  termo: string;
  volume: number;
  dificuldade: SeoDificuldade;
  cpc: number;
  intent: SeoIntent;
  tendencia: number;
  ideias: SeoKeywordIdea[];
  perguntas: string[];
}
