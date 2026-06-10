// Implementação mock — dataset de demonstração do TikTok.

import type { TikTokRepo } from './tiktokRepo';
import type { TikTokSummary } from './types';

const recentISO = (h: number): string => {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
};

const MOCK: TikTokSummary = {
  account: {
    username: '@theblondeconcept',
    seguidores: 8740,
    seguidores_delta_30d: 1240,
    curtidas_total: 184300,
    total_videos: 96,
    visualizacoes_dia: 14800,
    engajamento_taxa: 7.8,
    serie_seguidores: [
      { date: '01/04', value: 7500 }, { date: '08/04', value: 7720 },
      { date: '15/04', value: 8010 }, { date: '22/04', value: 8390 },
      { date: '29/04', value: 8740 },
    ],
    serie_views: [
      { date: 'Seg', value: 9200 },  { date: 'Ter', value: 12400 },
      { date: 'Qua', value: 18600 }, { date: 'Qui', value: 14100 },
      { date: 'Sex', value: 22800 }, { date: 'Sáb', value: 16300 },
      { date: 'Dom', value: 14800 },
    ],
  },
  videos: [
    { id:'t1', caption:'POV: você descobriu o segredo do loiro perfeito 🤍', thumbnail_url:'', publicado_em: recentISO(20),  visualizacoes:142800, curtidas:18400, comentarios:920, compartilhamentos:2400, engajamento_taxa:15.2 },
    { id:'t2', caption:'Transformação em 60 segundos ✨',                       thumbnail_url:'', publicado_em: recentISO(60),  visualizacoes: 48200, curtidas: 6100, comentarios:340, compartilhamentos: 780, engajamento_taxa:14.9 },
    { id:'t3', caption:'3 erros que descoloram errado o cabelo',                 thumbnail_url:'', publicado_em: recentISO(110), visualizacoes: 31600, curtidas: 3900, comentarios:210, compartilhamentos: 410, engajamento_taxa:14.3 },
    { id:'t4', caption:'Rotina de cuidados pós-descoloração 💧',                  thumbnail_url:'', publicado_em: recentISO(190), visualizacoes: 19400, curtidas: 2100, comentarios:118, compartilhamentos: 190, engajamento_taxa:12.4 },
    { id:'t5', caption:'Cliente reagindo ao resultado 🥹',                        thumbnail_url:'', publicado_em: recentISO(260), visualizacoes: 12700, curtidas: 1480, comentarios: 96, compartilhamentos: 120, engajamento_taxa:13.3 },
    { id:'t6', caption:'Antes x depois — mechas iluminadas',                      thumbnail_url:'', publicado_em: recentISO(330), visualizacoes:  8900, curtidas:  980, comentarios: 54, compartilhamentos:  72, engajamento_taxa:12.4 },
  ],
};

export const mockTikTokRepo: TikTokRepo = {
  async getSummary() {
    return MOCK;
  },
};

export { MOCK as MOCK_TIKTOK };
