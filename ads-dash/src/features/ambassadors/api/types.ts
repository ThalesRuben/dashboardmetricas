// Tipos públicos da feature `ambassadors`.

export type AmbassadorTypeKey = 'embaixador' | 'influenciador' | 'micro' | 'cliente-vip';
export type AmbassadorStatusKey = 'ativo' | 'negociando' | 'pausado';
export type AmbassadorPlatform = 'Instagram' | 'TikTok' | 'YouTube';

export interface Ambassador {
  id: string;
  nome: string;
  handle: string;
  plataforma: AmbassadorPlatform;
  tipo: AmbassadorTypeKey;
  seguidores: number;
  engajamento: number;
  status: AmbassadorStatusKey;
  cupom: string;
  cliques: number;
  vendas_atribuidas: number;
  receita_atribuida: number;
  comissao_pct: number;
  ultimo_post: string | null;
}

export interface AmbassadorPayload {
  nome: string;
  handle: string;
  plataforma?: AmbassadorPlatform;
  tipo?: AmbassadorTypeKey;
  seguidores?: number | string;
  engajamento?: number | string;
  status?: AmbassadorStatusKey;
  cupom?: string;
  comissao_pct?: number | string;
}
