// Motor de análise de virais — explica POR QUE um conteúdo performou e
// gera copy/roteiro adaptados. É o fallback local que imita a saída do
// Gemini; quando a Edge Function `gemini-analyze` estiver com chave real,
// a UI usa a resposta da API e cai para cá se falhar.

import type { AiBrain } from '@/features/ai/api/types'

export interface ViralInput {
  titulo?: string
  plataforma?: string
  views?: number
  curtidas?: number
  comentarios?: number
  compartilhamentos?: number
  salvamentos?: number
  duracao?: number
}

export interface ViralFator {
  dimensao: string
  valor: number
  nota: string
}

export interface ViralVeredito {
  label: 'VIRAL CONFIRMADO' | 'ALTA TRAÇÃO' | 'TRAÇÃO MODERADA'
  tone: 'accent' | 'amber' | 'magenta'
}

export interface ViralCopy {
  ganchos: string[]
  legenda: string
  cta: string[]
}

export interface ViralRoteiroItem {
  tempo: string
  acao: string
}

export interface ViralAnalysis {
  modelo: string
  score: number
  veredito: ViralVeredito
  fatores: ViralFator[]
  ranked: ViralFator[]
  porque: string[]
  copy: ViralCopy
  roteiro: ViralRoteiroItem[]
  gerado_em: string
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// pontua cada dimensão de viralização a partir dos números do conteúdo
function scoreDimensions(input: ViralInput): ViralFator[] {
  const views   = Number(input.views) || 0
  const likes   = Number(input.curtidas) || 0
  const coments = Number(input.comentarios) || 0
  const shares  = Number(input.compartilhamentos) || 0
  const saves   = Number(input.salvamentos) || 0
  const dur     = Number(input.duracao) || 30

  const engaj = views > 0 ? ((likes + coments + shares + saves) / views) * 100 : 0
  const shareRate = views > 0 ? (shares / views) * 100 : 0
  const saveRate  = views > 0 ? (saves / views) * 100 : 0
  const comentRate = views > 0 ? (coments / views) * 100 : 0

  return [
    { dimensao: 'Gancho (primeiros 3s)', valor: clamp(Math.round(50 + engaj * 6), 30, 99),
      nota: 'Estimado pela retenção implícita — engajamento alto indica que o início prendeu.' },
    { dimensao: 'Taxa de engajamento', valor: clamp(Math.round(engaj * 9), 20, 99),
      nota: `${engaj.toFixed(1)}% de interações sobre visualizações.` },
    { dimensao: 'Compartilhamento', valor: clamp(Math.round(shareRate * 40), 15, 99),
      nota: `${shareRate.toFixed(2)}% — conteúdo compartilhável amplia o alcance organicamente.` },
    { dimensao: 'Salvamento', valor: clamp(Math.round(saveRate * 45), 15, 99),
      nota: `${saveRate.toFixed(2)}% — salvamentos sinalizam valor de referência futura.` },
    { dimensao: 'Conversa (comentários)', valor: clamp(Math.round(comentRate * 60), 15, 99),
      nota: `${comentRate.toFixed(2)}% — comentários geram fôlego de distribuição.` },
    { dimensao: 'Formato e duração', valor: clamp(Math.round(dur >= 15 && dur <= 45 ? 88 : 64), 40, 95),
      nota: `${dur}s — a faixa de 15–45s costuma maximizar reprodução completa.` },
  ]
}

const HOOK_TEMPLATES: Array<(kw: string) => string> = [
  (kw) => `Ninguém te conta isso sobre ${kw}…`,
  (kw) => `O erro nº 1 que estraga ${kw} (e como evitar)`,
  (kw) => `Eu testei ${kw} por 30 dias — o resultado:`,
  (kw) => `Salva esse vídeo se você quer ${kw}`,
  (kw) => `POV: você finalmente descobriu o segredo de ${kw}`,
]
const CTA_TEMPLATES: string[] = [
  'Comenta "EU QUERO" que te mando os valores no direct.',
  'Agenda seu horário pelo link da bio — vagas limitadas essa semana.',
  'Salva esse vídeo e me segue pra não perder a parte 2.',
  'Marca uma amiga que precisa ver isso.',
]

export function analyzeViral(input: ViralInput, brain: Partial<AiBrain> = {}): ViralAnalysis {
  const fatores = scoreDimensions(input)
  const score = Math.round(fatores.reduce((s, f) => s + f.valor, 0) / fatores.length)

  const veredito: ViralVeredito =
    score >= 80 ? { label: 'VIRAL CONFIRMADO', tone: 'accent' } :
    score >= 62 ? { label: 'ALTA TRAÇÃO',      tone: 'amber'  } :
                  { label: 'TRAÇÃO MODERADA',  tone: 'magenta' }

  // ordena fatores pelo que mais puxou o resultado
  const ranked = [...fatores].sort((a, b) => b.valor - a.valor)
  const porque = [
    `O fator mais forte foi "${ranked[0].dimensao}" (${ranked[0].valor}/100): ${ranked[0].nota}`,
    `Logo em seguida, "${ranked[1].dimensao}" sustentou o alcance. ${ranked[1].nota}`,
    ranked[ranked.length - 1].valor < 55
      ? `Ponto a melhorar: "${ranked[ranked.length - 1].dimensao}" ficou abaixo — reforçar isso pode escalar ainda mais o próximo vídeo.`
      : 'Todos os fatores ficaram equilibrados — é um formato replicável com segurança.',
  ]

  const tema = (input.titulo || 'o tema do vídeo').toLowerCase()
  const kw = (brain.palavras_chave || '').split(',')[0]?.trim() || tema

  const copy: ViralCopy = {
    ganchos: HOOK_TEMPLATES.map(fn => fn(kw)),
    legenda:
      `${input.titulo || 'Transformação que vale a pena'} ✨\n\n` +
      `${brain.tom_de_voz ? '' : ''}Esse é o tipo de resultado que muda a autoestima. ` +
      `${brain.diferenciais ? brain.diferenciais.split(',')[0] + '. ' : ''}` +
      `Quer o mesmo pra você? ${CTA_TEMPLATES[0]}`,
    cta: CTA_TEMPLATES,
  }

  const roteiro: ViralRoteiroItem[] = [
    { tempo: '0–3s',   acao: `Gancho na tela: "${copy.ganchos[1]}". Mostrar o resultado final por 1 frame.` },
    { tempo: '3–10s',  acao: 'Apresentar o problema/dor que a cliente sente — gerar identificação.' },
    { tempo: '10–25s', acao: 'Mostrar o processo em cortes rápidos com texto grande explicando cada etapa.' },
    { tempo: '25–35s', acao: 'Revelar o antes e depois lado a lado + reação da cliente.' },
    { tempo: 'Final',  acao: `CTA falado e na tela: "${copy.cta[1]}"` },
  ]

  return {
    modelo: 'rules-engine (fallback)',
    score, veredito, fatores, ranked, porque, copy, roteiro,
    gerado_em: new Date().toISOString(),
  }
}

// exemplos prontos para o usuário testar sem digitar
export const VIRAL_PRESETS: ViralInput[] = [
  { titulo: 'POV: você descobriu o segredo do loiro perfeito', plataforma: 'TikTok',
    views: 142800, curtidas: 18400, comentarios: 920, compartilhamentos: 2400, salvamentos: 5100, duracao: 28 },
  { titulo: 'Transformação loira platinada do zero', plataforma: 'Instagram',
    views: 64200, curtidas: 9840, comentarios: 712, compartilhamentos: 880, salvamentos: 2100, duracao: 41 },
  { titulo: '3 erros que descoloram errado o cabelo', plataforma: 'Reels',
    views: 31600, curtidas: 3900, comentarios: 210, compartilhamentos: 410, salvamentos: 1400, duracao: 52 },
]
