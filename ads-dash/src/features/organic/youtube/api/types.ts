// Tipos públicos da feature `organic/youtube`.

export interface YouTubeSeriePoint {
  date: string;
  value: number;
}

export interface YouTubeChannel {
  channel_name: string;
  inscritos: number;
  inscritos_delta_30d: number;
  visualizacoes_dia: number;
  horas_assistidas: number;
  total_videos: number;
  engajamento_taxa: number;
  serie_inscritos: YouTubeSeriePoint[];
  serie_views: YouTubeSeriePoint[];
}

export interface YouTubeVideo {
  id: string;
  titulo: string;
  thumbnail_url: string;
  publicado_em: string;
  visualizacoes: number;
  curtidas: number;
  comentarios: number;
  retencao_media: number;
  duracao_seg: number;
}

export interface YouTubeSummary {
  channel: YouTubeChannel;
  videos: YouTubeVideo[];
}
