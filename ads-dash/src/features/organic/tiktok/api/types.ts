// Tipos públicos da feature `organic/tiktok`.

export interface TikTokSeriePoint {
  date: string;
  value: number;
}

export interface TikTokAccount {
  username: string;
  seguidores: number;
  seguidores_delta_30d: number;
  curtidas_total: number;
  total_videos: number;
  visualizacoes_dia: number;
  engajamento_taxa: number;
  serie_seguidores: TikTokSeriePoint[];
  serie_views: TikTokSeriePoint[];
}

export interface TikTokVideo {
  id: string;
  caption: string;
  thumbnail_url: string;
  publicado_em: string;
  visualizacoes: number;
  curtidas: number;
  comentarios: number;
  compartilhamentos: number;
  engajamento_taxa: number;
}

export interface TikTokSummary {
  account: TikTokAccount;
  videos: TikTokVideo[];
}
