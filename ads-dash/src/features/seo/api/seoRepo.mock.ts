// Implementação mock — snapshot SEO de demonstração.

import type { SeoRepo, AddMonitoredInput } from './seoRepo';
import type {
  SeoSnapshot,
  SeoKeywordResearch,
  SeoKeywordIdea,
  SeoKeyword,
  SeoDificuldade,
  SeoIntent,
} from './types';

const LS_KEY = 'seo:monitored:extra';

function loadExtras(): SeoKeyword[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as SeoKeyword[]) : [];
  } catch {
    return [];
  }
}

function saveExtras(extras: SeoKeyword[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(extras));
  } catch {}
}

const MOCK: SeoSnapshot = {
  score: 68,
  score_delta: 4,
  resumo: {
    keywords_monitoradas: 24,
    no_top10: 9,
    trafego_organico_mes: 3120,
    trafego_delta: 12.4,
  },
  keywords: [
    { termo: 'salão de beleza loiro',        posicao: 4,  posicao_anterior: 7,  volume: 2400, dificuldade: 'média', oportunidade: 'alta' },
    { termo: 'mechas iluminadas preço',      posicao: 8,  posicao_anterior: 8,  volume: 1300, dificuldade: 'baixa', oportunidade: 'alta' },
    { termo: 'progressiva sem formol',       posicao: 12, posicao_anterior: 18, volume: 3100, dificuldade: 'alta',  oportunidade: 'alta' },
    { termo: 'corte feminino moderno',       posicao: 6,  posicao_anterior: 5,  volume: 1800, dificuldade: 'média', oportunidade: 'média' },
    { termo: 'cronograma capilar caseiro',   posicao: 21, posicao_anterior: 25, volume: 5400, dificuldade: 'média', oportunidade: 'alta' },
    { termo: 'salão de beleza perto de mim', posicao: 3,  posicao_anterior: 4,  volume: 8200, dificuldade: 'alta',  oportunidade: 'média' },
    { termo: 'penteado de noiva',            posicao: 15, posicao_anterior: 14, volume: 2700, dificuldade: 'média', oportunidade: 'média' },
  ],
  sugestoes: [
    { titulo: '"Cronograma capilar caseiro: guia completo passo a passo"', tipo: 'Blog / artigo', prioridade: 'alta',
      descricao: 'Termo com 5,4k buscas/mês e você está na pos. 21. Artigo educativo bem estruturado pode subir pro top 10 em ~60 dias.' },
    { titulo: '"Progressiva sem formol vale a pena? Preços e cuidados"', tipo: 'Blog / artigo', prioridade: 'alta',
      descricao: 'Volume alto (3,1k) e intenção comercial. Inclua tabela de preços e FAQ para capturar featured snippet.' },
    { titulo: 'Otimizar página do Google Meu Negócio', tipo: 'SEO local', prioridade: 'alta',
      descricao: '"Perto de mim" traz 8,2k buscas. Atualize fotos, horários e responda avaliações para reforçar o SEO local.' },
    { titulo: '"Mechas iluminadas: tipos, preço e manutenção"', tipo: 'Landing page', prioridade: 'média',
      descricao: 'Já está na pos. 8 — uma página dedicada com CTA de agendamento empurra para o top 5.' },
  ],
  auditoria: [
    { item: 'Velocidade de carregamento (mobile)', status: 'ok',     nota: 'LCP 2,1s — dentro do recomendado.' },
    { item: 'Meta descriptions',                   status: 'alerta', nota: '6 páginas sem meta description.' },
    { item: 'Títulos H1 únicos',                   status: 'ok',     nota: 'Todas as páginas com H1 único.' },
    { item: 'Imagens com texto alternativo (alt)',  status: 'erro',   nota: '38% das imagens sem atributo alt.' },
    { item: 'Links internos',                       status: 'alerta', nota: 'Blog pouco conectado às páginas de serviço.' },
    { item: 'Sitemap e indexação',                  status: 'ok',     nota: 'Sitemap enviado, 41 páginas indexadas.' },
  ],
};

// hash determinístico simples (djb2) — mesmo termo sempre gera o mesmo resultado.
function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(seed: number, arr: T[]): T {
  return arr[seed % arr.length];
}

const PREFIXOS = ['melhor', 'como fazer', 'preço de', 'tipos de', 'cuidados com'];
const SUFIXOS  = ['em casa', 'profissional', 'feminino', 'passo a passo', 'duradouro', '2026'];
const PERGUNTAS_BASE = [
  (t: string) => `Quanto custa ${t}?`,
  (t: string) => `${t.charAt(0).toUpperCase() + t.slice(1)} faz mal?`,
  (t: string) => `Quanto tempo dura ${t}?`,
  (t: string) => `Como fazer ${t} em casa?`,
  (t: string) => `Qual a diferença entre ${t} e outras técnicas?`,
];

function buildResearch(termoRaw: string): SeoKeywordResearch {
  const termo = termoRaw.trim().toLowerCase();
  const h = hash(termo);

  const volume = 200 + (h % 9800);
  const dificuldade: SeoDificuldade = (['baixa', 'média', 'alta'] as const)[h % 3];
  const cpc = +(0.4 + ((h >> 3) % 350) / 100).toFixed(2);
  const intent: SeoIntent = (['informacional', 'comercial', 'transacional', 'local'] as const)[h % 4];
  const tendencia = ((h >> 5) % 60) - 20; // -20 a +40 (%)

  const ideias: SeoKeywordIdea[] = Array.from({ length: 6 }, (_, i) => {
    const seed = hash(`${termo}-${i}`);
    const usaPrefixo = (seed % 2) === 0;
    const t = usaPrefixo
      ? `${pick(seed, PREFIXOS)} ${termo}`
      : `${termo} ${pick(seed >> 2, SUFIXOS)}`;
    return {
      termo: t,
      volume: 80 + (seed % 4200),
      dificuldade: (['baixa', 'média', 'alta'] as const)[seed % 3],
      intent: (['informacional', 'comercial', 'transacional', 'local'] as const)[(seed >> 4) % 4],
    };
  });

  const perguntas = PERGUNTAS_BASE
    .map((fn, i) => ({ q: fn(termo), s: hash(`${termo}-q-${i}`) }))
    .sort((a, b) => a.s - b.s)
    .slice(0, 4)
    .map(x => x.q);

  return { termo, volume, dificuldade, cpc, intent, tendencia, ideias, perguntas };
}

export const mockSeoRepo: SeoRepo = {
  async getSnapshot() {
    const extras = loadExtras();
    if (!extras.length) return MOCK;
    const termos = new Set(MOCK.keywords.map(k => k.termo));
    const merged = [...MOCK.keywords, ...extras.filter(e => !termos.has(e.termo))];
    return {
      ...MOCK,
      keywords: merged,
      resumo: { ...MOCK.resumo, keywords_monitoradas: merged.length },
    };
  },
  async researchKeyword(termo: string) {
    const clean = termo.trim();
    if (!clean) return null;
    return buildResearch(clean);
  },
  async addMonitoredKeyword(input: AddMonitoredInput) {
    const termo = input.termo.trim();
    if (!termo) return { ok: false, error: 'Termo vazio.' };
    const extras = loadExtras();
    if (MOCK.keywords.some(k => k.termo === termo) || extras.some(e => e.termo === termo)) {
      return { ok: false, error: 'Termo já monitorado.' };
    }
    const research = buildResearch(termo);
    extras.push({
      termo,
      posicao: 0,
      posicao_anterior: 0,
      volume: input.volume ?? research.volume,
      dificuldade: input.dificuldade ?? research.dificuldade,
      oportunidade: input.oportunidade ?? 'média',
    });
    saveExtras(extras);
    return { ok: true };
  },
};

export { MOCK as MOCK_SEO, buildResearch as buildMockResearch };
