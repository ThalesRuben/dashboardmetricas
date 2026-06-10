// Implementação Supabase — usa as tabelas tiktok_account_metrics e tiktok_videos.

import { supabase } from '@/shared/lib/supabase';
import type { TikTokRepo } from './tiktokRepo';
import { MOCK_TIKTOK } from './tiktokRepo.mock';

export const supabaseTikTokRepo: TikTokRepo = {
  async getSummary() {
    const [accRes, vidRes] = await Promise.all([
      supabase.from('tiktok_account_metrics').select('*').order('date', { ascending: false }).limit(30),
      supabase.from('tiktok_videos').select('*').order('publicado_em', { ascending: false }).limit(20),
    ]);
    if (accRes.error || !accRes.data?.length) return null;

    const rows = accRes.data;
    const latest = rows[0];
    const oldest = rows[rows.length - 1];

    return {
      account: {
        username: latest.username || '@conta',
        seguidores: latest.seguidores,
        seguidores_delta_30d: latest.seguidores - (oldest?.seguidores ?? latest.seguidores),
        curtidas_total: latest.curtidas_total,
        total_videos: latest.total_videos,
        visualizacoes_dia: latest.visualizacoes_dia,
        engajamento_taxa: Number(latest.engajamento_taxa),
        serie_seguidores: [...rows].reverse().map(r => ({
          date: new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          value: r.seguidores,
        })),
        serie_views: MOCK_TIKTOK.account.serie_views,
      },
      videos: vidRes.data || [],
    };
  },
};
