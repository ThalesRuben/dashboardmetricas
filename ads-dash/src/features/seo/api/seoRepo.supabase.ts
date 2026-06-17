// Implementação Supabase — snapshot agregado + keywords monitoradas (tabela própria)
// + cache de pesquisa. Multi-tenant via RLS (tenant_id default = current_user_first_tenant()).

import { supabase } from '@/shared/lib/supabase';
import type { SeoRepo, AddMonitoredInput } from './seoRepo';
import { MOCK_SEO, buildMockResearch } from './seoRepo.mock';
import type { SeoKeyword, SeoKeywordResearch } from './types';

export const supabaseSeoRepo: SeoRepo = {
  async getSnapshot() {
    const [{ data: snapRows, error: snapErr }, { data: kwRows, error: kwErr }] = await Promise.all([
      supabase.from('seo_snapshots').select('*').order('date', { ascending: false }).limit(1),
      supabase.from('seo_monitored_keywords').select('*').eq('ativo', true).order('volume', { ascending: false }),
    ]);

    if (snapErr) console.error('[seoRepo.getSnapshot]', snapErr);
    if (kwErr)   console.error('[seoRepo.getSnapshot] monitored', kwErr);

    const base = snapRows?.[0]?.payload
      ? { ...MOCK_SEO, ...snapRows[0].payload, score: snapRows[0].score ?? MOCK_SEO.score }
      : MOCK_SEO;

    if (!kwRows?.length) return base;

    const keywords: SeoKeyword[] = kwRows.map(r => ({
      termo: r.termo,
      posicao: r.posicao ?? 0,
      posicao_anterior: r.posicao_anterior ?? r.posicao ?? 0,
      volume: r.volume ?? 0,
      dificuldade: r.dificuldade ?? 'média',
      oportunidade: r.oportunidade ?? 'média',
    }));

    const no_top10 = keywords.filter(k => k.posicao > 0 && k.posicao <= 10).length;

    return {
      ...base,
      keywords,
      resumo: { ...base.resumo, keywords_monitoradas: keywords.length, no_top10 },
    };
  },

  async researchKeyword(termo: string) {
    const clean = termo.trim();
    if (!clean) return null;

    // 1) tenta servir do cache (último resultado < 7 dias)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from('seo_research_history')
      .select('payload')
      .eq('termo', clean)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    let research: SeoKeywordResearch;
    if (cached?.[0]?.payload) {
      research = cached[0].payload as SeoKeywordResearch;
    } else {
      // TODO: trocar por integração real (Google Keyword Planner / SEMrush / Ahrefs).
      research = buildMockResearch(clean);
      const { error } = await supabase.from('seo_research_history').insert({
        termo: research.termo,
        volume: research.volume,
        dificuldade: research.dificuldade,
        intent: research.intent,
        payload: research,
      });
      if (error) console.error('[seoRepo.researchKeyword] cache write', error);
    }
    return research;
  },

  async addMonitoredKeyword(input: AddMonitoredInput) {
    const termo = input.termo.trim();
    if (!termo) return { ok: false, error: 'Termo vazio.' };

    const research = buildMockResearch(termo);
    const { error } = await supabase.from('seo_monitored_keywords').insert({
      termo,
      volume: input.volume ?? research.volume,
      dificuldade: input.dificuldade ?? research.dificuldade,
      oportunidade: input.oportunidade ?? 'média',
    });

    if (error) {
      if (error.code === '23505') return { ok: false, error: 'Termo já monitorado.' };
      console.error('[seoRepo.addMonitoredKeyword]', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  },
};
