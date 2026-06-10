// Tipos públicos da feature `competitors`.

export interface CompetitorBrand {
  id: string;
  tenantId: string;
  nome: string;
  handle: string;
  platform: string;       // 'instagram' | 'tiktok' | ...
  segmento: string;
  website?: string;
  niche?: string;
  createdAt: string;
}

export interface CompetitorSnapshot {
  id: string;
  brandId: string;
  date: string;
  followers: number;
  engagement: number;
  postsCount: number;
}

export interface CompetitorContent {
  id: string;
  brandId: string;
  externalId: string;
  caption: string;
  tags: string[];          // CONTENT_TAGS keys
  dimensions: Record<string, string>; // CONTENT_DIMENSIONS keys -> option key
  score: number;
  postedAt: string;
}
