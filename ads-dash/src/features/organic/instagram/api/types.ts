// Tipos públicos da feature `organic/instagram`.

export interface InstagramAccount {
  id: string;
  tenantId: string;
  handle: string;
  followers: number;
  following: number;
  bio?: string;
  createdAt: string;
}

export type IgMediaType = 'image' | 'video' | 'reel' | 'carousel' | 'story';

export interface InstagramPost {
  id: string;
  tenantId: string;
  accountId: string;
  externalId: string;
  mediaType: IgMediaType;
  caption: string;
  permalink: string;
  thumbnailUrl?: string;
  postedAt: string;
}

export interface InstagramPostMetrics {
  postId: string;
  date: string;
  impressoes: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  plays?: number;
  engagement: number;
}

export interface InstagramSummary {
  followers: number;
  reach30d: number;
  engagement30d: number;
  posts30d: number;
  topMediaType: IgMediaType | null;
}
