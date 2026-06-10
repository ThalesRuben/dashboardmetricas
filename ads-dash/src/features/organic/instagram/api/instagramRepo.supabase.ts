// Implementação Supabase — usa tabelas organic_* da migration 0003_organic.sql.

import { supabase } from '@/shared/lib/supabase';
import type { InstagramRepo } from './instagramRepo';
import type {
  InstagramAccount,
  InstagramPost,
  InstagramPostMetrics,
} from './types';

const PLATFORM = 'instagram';

export const supabaseInstagramRepo: InstagramRepo = {
  async getAccount() {
    const { data, error } = await supabase
      .from('organic_accounts')
      .select('*')
      .eq('platform', PLATFORM)
      .maybeSingle();
    if (error) {
      console.error('[instagramRepo.getAccount]', error);
      return null;
    }
    return data ? (data as unknown as InstagramAccount) : null;
  },

  async listPosts({ from, to, limit = 100 } = {}) {
    let q = supabase
      .from('organic_posts')
      .select('*')
      .eq('platform', PLATFORM)
      .order('posted_at', { ascending: false })
      .limit(limit);
    if (from) q = q.gte('posted_at', from);
    if (to) q = q.lte('posted_at', to);
    const { data, error } = await q;
    if (error) {
      console.error('[instagramRepo.listPosts]', error);
      return [];
    }
    return (data ?? []) as unknown as InstagramPost[];
  },

  async getPostMetrics(postId) {
    const { data, error } = await supabase
      .from('organic_post_metrics')
      .select('*')
      .eq('post_id', postId)
      .order('date', { ascending: true });
    if (error) {
      console.error('[instagramRepo.getPostMetrics]', error);
      return [];
    }
    return (data ?? []) as unknown as InstagramPostMetrics[];
  },

  async getSummary() {
    // TODO: usar view materializada `organic_ig_30d_summary` ou RPC.
    return null;
  },
};
