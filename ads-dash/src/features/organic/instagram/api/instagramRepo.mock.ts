// Implementação mock — devolve dados gerados pelo MetricsContext por enquanto.
// TODO(refactor): mover gerador determinístico pra cá; useInstagramMetrics consome via repo.

import type { InstagramRepo } from './instagramRepo';

export const mockInstagramRepo: InstagramRepo = {
  async getAccount() {
    return null;
  },
  async listPosts() {
    return [];
  },
  async getPostMetrics() {
    return [];
  },
  async getSummary() {
    return null;
  },
};
