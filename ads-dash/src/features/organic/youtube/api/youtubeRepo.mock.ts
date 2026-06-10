// Implementação mock — dataset de demonstração do YouTube.

import type { YouTubeRepo } from './youtubeRepo';
import type { YouTubeSummary } from './types';

const daysAgoISO = (d: number): string => {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString();
};

const MOCK: YouTubeSummary = {
  channel: {
    channel_name: 'The Blonde Concept',
    inscritos: 3420,
    inscritos_delta_30d: 380,
    visualizacoes_dia: 2840,
    horas_assistidas: 1180.5,
    total_videos: 42,
    engajamento_taxa: 5.4,
    serie_inscritos: [
      { date: '01/04', value: 3040 }, { date: '08/04', value: 3120 },
      { date: '15/04', value: 3210 }, { date: '22/04', value: 3315 },
      { date: '29/04', value: 3420 },
    ],
    serie_views: [
      { date: 'Sem 1', value: 16800 }, { date: 'Sem 2', value: 19400 },
      { date: 'Sem 3', value: 21200 }, { date: 'Sem 4', value: 23900 },
    ],
  },
  videos: [
    { id:'y1', titulo:'Loiro do zero: o passo a passo COMPLETO',          thumbnail_url:'', publicado_em: daysAgoISO(6),  visualizacoes:18400, curtidas:1240, comentarios:186, retencao_media:58.2, duracao_seg:842 },
    { id:'y2', titulo:'Como cuidar do cabelo loiro em casa',               thumbnail_url:'', publicado_em: daysAgoISO(14), visualizacoes:11200, curtidas: 780, comentarios: 94, retencao_media:52.7, duracao_seg:614 },
    { id:'y3', titulo:'Tour pelo salão + nossa filosofia de trabalho',     thumbnail_url:'', publicado_em: daysAgoISO(23), visualizacoes: 7600, curtidas: 512, comentarios: 61, retencao_media:47.1, duracao_seg:498 },
    { id:'y4', titulo:'Erros que destroem o cabelo descolorido',           thumbnail_url:'', publicado_em: daysAgoISO(34), visualizacoes: 9800, curtidas: 690, comentarios: 78, retencao_media:55.4, duracao_seg:402 },
    { id:'y5', titulo:'Transformação real — depoimento de cliente',        thumbnail_url:'', publicado_em: daysAgoISO(45), visualizacoes: 5400, curtidas: 388, comentarios: 44, retencao_media:49.8, duracao_seg:286 },
  ],
};

export const mockYouTubeRepo: YouTubeRepo = {
  async getSummary() {
    return MOCK;
  },
};

export { MOCK as MOCK_YOUTUBE };
