// Implementação mock — diretriz persistida em localStorage.

import type { AiBrainRepo } from './aiBrainRepo';
import type { AiBrain } from './types';
import { DEFAULT_BRAIN } from '../lib/constants';

const STORAGE_KEY = 'ads-dash:ai-brain';

function load(): AiBrain {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_BRAIN, ...(JSON.parse(raw) as Partial<AiBrain>) } : DEFAULT_BRAIN;
  } catch { return DEFAULT_BRAIN; }
}

export const mockAiBrainRepo: AiBrainRepo = {
  async get() {
    return load();
  },
  async save(brain) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(brain)); } catch { /* ignore */ }
    return { error: null };
  },
};
