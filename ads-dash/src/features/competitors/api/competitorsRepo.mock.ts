// Implementação mock — useCompetitors ainda devolve dados próprios via MOCK_COMPETITORS.
// Quando refatorarmos, esses dados migram pra cá e o hook passa a consumir do repo.

import type { CompetitorsRepo } from './competitorsRepo';

export const mockCompetitorsRepo: CompetitorsRepo = {
  async listBrands() {
    return [];
  },
  async getSnapshots() {
    return [];
  },
  async listContent() {
    return [];
  },
  async upsertBrand() {
    return { ok: true };
  },
};
