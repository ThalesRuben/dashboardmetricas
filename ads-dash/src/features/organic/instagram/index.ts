// API pública da feature `organic/instagram`.

// Hooks
export { useInstagramMetrics } from './hooks/useInstagramMetrics';

// Lib
export { detectHype, HYPE_LEVELS } from './lib/hypeDetector';
export { analyzeViral, VIRAL_PRESETS } from './lib/viralAnalysis';

// Components
export { default as ChannelEngines } from './components/ChannelEngines';
export { default as ContentCalendar } from './components/ContentCalendar';
export { default as HypeBanner } from './components/HypeBanner';
export { default as IgAiInsights } from './components/IgAiInsights';
export { default as IgEngagementChart } from './components/IgEngagementChart';
export { default as IgGrowthChart } from './components/IgGrowthChart';
export { default as IgReachChart } from './components/IgReachChart';
export { default as IgTimeline } from './components/IgTimeline';
export { default as IgTopPosts } from './components/IgTopPosts';

// API
export { instagramRepo } from './api/instagramRepo';
export type {
  InstagramAccount,
  InstagramPost,
  InstagramPostMetrics,
  InstagramSummary,
  IgMediaType,
} from './api/types';
