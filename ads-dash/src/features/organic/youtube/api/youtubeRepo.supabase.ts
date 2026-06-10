// Implementação Supabase — usa as tabelas youtube_channel_metrics e youtube_videos.

import { supabase } from '@/shared/lib/supabase';
import type { YouTubeRepo } from './youtubeRepo';
import { MOCK_YOUTUBE } from './youtubeRepo.mock';

export const supabaseYouTubeRepo: YouTubeRepo = {
  async getSummary() {
    const [chRes, vidRes] = await Promise.all([
      supabase.from('youtube_channel_metrics').select('*').order('date', { ascending: false }).limit(30),
      supabase.from('youtube_videos').select('*').order('publicado_em', { ascending: false }).limit(20),
    ]);
    if (chRes.error || !chRes.data?.length) return null;

    const rows = chRes.data;
    const latest = rows[0];
    const oldest = rows[rows.length - 1];

    return {
      channel: {
        channel_name: latest.channel_name || 'Canal',
        inscritos: latest.inscritos,
        inscritos_delta_30d: latest.inscritos - (oldest?.inscritos ?? latest.inscritos),
        visualizacoes_dia: latest.visualizacoes_dia,
        horas_assistidas: Number(latest.horas_assistidas),
        total_videos: latest.total_videos,
        engajamento_taxa: Number(latest.engajamento_taxa),
        serie_inscritos: [...rows].reverse().map(r => ({
          date: new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          value: r.inscritos,
        })),
        serie_views: MOCK_YOUTUBE.channel.serie_views,
      },
      videos: vidRes.data || [],
    };
  },
};
