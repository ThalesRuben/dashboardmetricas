// Implementação mock — snapshot SEO de demonstração.

import type { SeoRepo } from './seoRepo';
import type { SeoSnapshot } from './types';

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

export const mockSeoRepo: SeoRepo = {
  async getSnapshot() {
    return MOCK;
  },
};

export { MOCK as MOCK_SEO };
