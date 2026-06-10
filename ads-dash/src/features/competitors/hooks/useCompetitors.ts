import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'

// ============================================================================
// Tipos públicos
// ============================================================================

export type CompetitorTipo = 'concorrente' | 'referencia'
export type ContentTipo = 'REEL' | 'CAROUSEL' | 'IMAGE' | 'STORY'
export type GanchoKey = 'resultado' | 'pergunta' | 'choque' | 'antes-depois' | 'storytelling' | 'polemica' | 'bastidor'
export type EmocaoKey = 'surpresa' | 'inspiracao' | 'identificacao' | 'urgencia' | 'humor' | 'curiosidade' | 'confianca'
export type AudioKey = 'trend' | 'original' | 'musica' | 'voz-off' | 'sem-audio'
export type RitmoKey = 'cortes-rapidos' | 'ritmo-medio' | 'plano-unico' | 'slideshow'
export type DimensionKey = 'gancho' | 'emocao' | 'audio' | 'ritmo_edicao'

export interface CompetitorSnapshot {
  date: string
  seguidores: number
  total_posts: number
  engajamento_taxa: number
  posts_semana: number
  seguidores_tiktok?: number
  seguidores_youtube?: number
  seguidores_facebook?: number
  reclame_aqui_nota?: number
  reclame_aqui_reclamacoes?: number
  reclame_aqui_resolvidas_pct?: number
  observacoes?: string
}

export interface CompetitorContent {
  id: string
  tipo: ContentTipo
  tag: string
  tema: string
  permalink?: string
  data_publicado?: string | null
  curtidas: number
  comentarios: number
  engajamento_taxa: number
  formato_nota?: string
  gancho?: GanchoKey | null
  emocao?: EmocaoKey | null
  audio?: AudioKey | null
  ritmo_edicao?: RitmoKey | null
  validado: boolean
}

export interface Competitor {
  id: string
  nome: string
  handle: string
  segmento: string
  website?: string
  cor: string
  tipo: CompetitorTipo
  ativo: boolean
  snapshots: CompetitorSnapshot[]
  content: CompetitorContent[]
}

export interface CompetitorPayload {
  nome: string
  handle: string
  segmento: string
  website?: string
  cor: string
  tipo?: CompetitorTipo
}

export interface LatestSnapshot extends CompetitorSnapshot {
  seguidores_delta: number
  series: CompetitorSnapshot[]
}

export interface ContentTagOption { key: string; label: string }
export interface ContentDimensionOption { key: string; label: string }
export interface ContentDimension {
  label: string
  options: ContentDimensionOption[]
}

// ============================================================================

const STORAGE_KEY = 'ads-dash:competitors-fallback'

// Datas dos snapshots (a cada ~5 dias no último mês)
const SNAP_DATES = ['01/04', '08/04', '15/04', '22/04', '29/04']

// Categorias de conteúdo (validado = comprovadamente performou)
export const CONTENT_TAGS: ContentTagOption[] = [
  { key: 'antes-depois', label: 'Antes e depois' },
  { key: 'tutorial',     label: 'Tutorial / passo a passo' },
  { key: 'promo',        label: 'Promoção / oferta' },
  { key: 'bastidor',     label: 'Bastidor' },
  { key: 'depoimento',   label: 'Depoimento de cliente' },
  { key: 'tendencia',    label: 'Tendência' },
  { key: 'dica',         label: 'Dica / educativo' },
]

// Taxonomia rica — analisa o "COMO" do conteúdo, não só o "o quê".
// Inspirado no modelo de análise de conteúdo de referência (transcrição 05-16).
export const CONTENT_DIMENSIONS: Record<DimensionKey, ContentDimension> = {
  gancho: {
    label: 'Gancho (primeiros segundos)',
    options: [
      { key: 'resultado',     label: 'Mostra o resultado primeiro' },
      { key: 'pergunta',      label: 'Abre com pergunta' },
      { key: 'choque',        label: 'Afirmação/dado de impacto' },
      { key: 'antes-depois',  label: 'Antes e depois imediato' },
      { key: 'storytelling',  label: 'História / narrativa' },
      { key: 'polemica',      label: 'Opinião polêmica' },
      { key: 'bastidor',      label: 'Puxa pra dentro (bastidor)' },
    ],
  },
  emocao: {
    label: 'Emoção evocada',
    options: [
      { key: 'surpresa',      label: 'Surpresa' },
      { key: 'inspiracao',    label: 'Inspiração' },
      { key: 'identificacao', label: 'Identificação' },
      { key: 'urgencia',      label: 'Urgência' },
      { key: 'humor',         label: 'Humor' },
      { key: 'curiosidade',   label: 'Curiosidade' },
      { key: 'confianca',     label: 'Confiança / prova social' },
    ],
  },
  audio: {
    label: 'Estratégia de áudio',
    options: [
      { key: 'trend',     label: 'Áudio em alta (trend)' },
      { key: 'original',  label: 'Áudio original / fala' },
      { key: 'musica',    label: 'Música licenciada' },
      { key: 'voz-off',   label: 'Narração (voz off)' },
      { key: 'sem-audio', label: 'Sem áudio relevante' },
    ],
  },
  ritmo_edicao: {
    label: 'Ritmo de edição',
    options: [
      { key: 'cortes-rapidos', label: 'Cortes rápidos / dinâmico' },
      { key: 'ritmo-medio',    label: 'Ritmo médio' },
      { key: 'plano-unico',    label: 'Plano único / contínuo' },
      { key: 'slideshow',      label: 'Slideshow / fotos' },
    ],
  },
}

export function dimensionLabel(dim: DimensionKey | string, key: string | null | undefined): string {
  const opt = CONTENT_DIMENSIONS[dim as DimensionKey]?.options.find(o => o.key === key)
  return opt?.label || key || '—'
}

// Mock — 3 salões concorrentes com histórico de snapshots e conteúdos validados
const MOCK_COMPETITORS: Competitor[] = [
  {
    id: 'c1',
    nome: 'Espaço Vip',
    handle: '@espacovip.salao',
    segmento: 'Salão de beleza',
    website: 'espacovip.com.br',
    cor: '#E1306C',
    tipo: 'concorrente',
    ativo: true,
    snapshots: [
      { date: '01/04', seguidores: 23100, total_posts: 612, engajamento_taxa: 3.2, posts_semana: 7 },
      { date: '08/04', seguidores: 23380, total_posts: 619, engajamento_taxa: 3.3, posts_semana: 7 },
      { date: '15/04', seguidores: 23590, total_posts: 626, engajamento_taxa: 3.4, posts_semana: 7 },
      { date: '22/04', seguidores: 23820, total_posts: 633, engajamento_taxa: 3.3, posts_semana: 7 },
      { date: '29/04', seguidores: 24100, total_posts: 641, engajamento_taxa: 3.4, posts_semana: 7,
        seguidores_tiktok: 6200, seguidores_youtube: 0, seguidores_facebook: 14800,
        reclame_aqui_nota: 6.8, reclame_aqui_reclamacoes: 42, reclame_aqui_resolvidas_pct: 71 },
    ],
    content: [
      { id:'ct1', tipo:'REEL',     tag:'antes-depois', tema:'Transformação loira platinada do zero', data_publicado:'2026-04-24', curtidas:9840, comentarios:712, engajamento_taxa:12.4, formato_nota:'Hook nos primeiros 2s mostrando o "depois", só revela o processo depois.', gancho:'resultado', emocao:'surpresa', audio:'trend', ritmo_edicao:'cortes-rapidos', validado:true },
      { id:'ct2', tipo:'CAROUSEL', tag:'promo',        tema:'Tabela de preços 2026 — pacote noiva', data_publicado:'2026-04-19', curtidas:1820, comentarios:243, engajamento_taxa:6.8, formato_nota:'Carrossel com preço claro no 1º slide. Muito salvamento.', gancho:'choque', emocao:'urgencia', audio:'sem-audio', ritmo_edicao:'slideshow', validado:true },
    ],
  },
  {
    id: 'c2',
    nome: 'Studio Glam',
    handle: '@studioglam.bh',
    segmento: 'Salão de beleza',
    website: 'studioglam.com',
    cor: '#F58529',
    tipo: 'concorrente',
    ativo: true,
    snapshots: [
      { date: '01/04', seguidores: 17200, total_posts: 388, engajamento_taxa: 5.0, posts_semana: 5 },
      { date: '08/04', seguidores: 17480, total_posts: 393, engajamento_taxa: 5.1, posts_semana: 5 },
      { date: '15/04', seguidores: 17790, total_posts: 399, engajamento_taxa: 5.3, posts_semana: 5 },
      { date: '22/04', seguidores: 18100, total_posts: 404, engajamento_taxa: 5.2, posts_semana: 5 },
      { date: '29/04', seguidores: 18420, total_posts: 410, engajamento_taxa: 5.4, posts_semana: 5,
        seguidores_tiktok: 11400, seguidores_youtube: 2100, seguidores_facebook: 8900,
        reclame_aqui_nota: 8.4, reclame_aqui_reclamacoes: 11, reclame_aqui_resolvidas_pct: 91 },
    ],
    content: [
      { id:'ct3', tipo:'REEL',  tag:'tutorial',  tema:'Como fazer cacheado perfeito em casa', data_publicado:'2026-04-26', curtidas:4210, comentarios:389, engajamento_taxa:9.6, formato_nota:'Tutorial rápido, áudio em alta, legenda passo a passo. Muito compartilhamento.', gancho:'pergunta', emocao:'curiosidade', audio:'trend', ritmo_edicao:'cortes-rapidos', validado:true },
      { id:'ct4', tipo:'REEL',  tag:'bastidor',  tema:'Bastidor: dia de noiva no salão', data_publicado:'2026-04-21', curtidas:2980, comentarios:201, engajamento_taxa:8.2, formato_nota:'Mostra a emoção da cliente — gera conexão e prova social.', gancho:'bastidor', emocao:'identificacao', audio:'musica', ritmo_edicao:'ritmo-medio', validado:true },
      { id:'ct5', tipo:'IMAGE', tag:'dica',      tema:'5 erros que estragam o cabelo no inverno', data_publicado:'2026-04-12', curtidas:1640, comentarios:88, engajamento_taxa:5.1, formato_nota:'Conteúdo educativo gera autoridade. Salvamento alto.', gancho:'choque', emocao:'curiosidade', audio:'sem-audio', ritmo_edicao:'slideshow', validado:true },
    ],
  },
  {
    id: 'c3',
    nome: 'Bella Hair',
    handle: '@bellahair.oficial',
    segmento: 'Salão de beleza',
    website: '',
    cor: '#8134AF',
    tipo: 'concorrente',
    ativo: true,
    snapshots: [
      { date: '01/04', seguidores: 9100,  total_posts: 244, engajamento_taxa: 5.8, posts_semana: 4 },
      { date: '08/04', seguidores: 9280,  total_posts: 248, engajamento_taxa: 6.0, posts_semana: 4 },
      { date: '15/04', seguidores: 9460,  total_posts: 253, engajamento_taxa: 6.2, posts_semana: 4 },
      { date: '22/04', seguidores: 9640,  total_posts: 257, engajamento_taxa: 6.1, posts_semana: 4 },
      { date: '29/04', seguidores: 9810,  total_posts: 262, engajamento_taxa: 6.3, posts_semana: 4,
        seguidores_tiktok: 3800, seguidores_youtube: 0, seguidores_facebook: 5200,
        reclame_aqui_nota: 7.9, reclame_aqui_reclamacoes: 8, reclame_aqui_resolvidas_pct: 88 },
    ],
    content: [
      { id:'ct6', tipo:'REEL',  tag:'depoimento',   tema:'Cliente há 5 anos conta a experiência', data_publicado:'2026-04-27', curtidas:2440, comentarios:178, engajamento_taxa:11.1, formato_nota:'Depoimento real e espontâneo. Constrói confiança — converte muito.', gancho:'storytelling', emocao:'confianca', audio:'original', ritmo_edicao:'plano-unico', validado:true },
      { id:'ct7', tipo:'IMAGE', tag:'antes-depois', tema:'Antes e depois corte pixie', data_publicado:'2026-04-16', curtidas:740, comentarios:52, engajamento_taxa:7.4, formato_nota:'Foto lado a lado simples, mas o resultado impactante carrega o post.', gancho:'antes-depois', emocao:'surpresa', audio:'sem-audio', ritmo_edicao:'slideshow', validado:true },
    ],
  },
  {
    id: 'r1',
    nome: 'Lorena Hair (referência)',
    handle: '@lorenahair',
    segmento: 'Cabeleireira de referência',
    website: '',
    cor: '#1D9E75',
    tipo: 'referencia',
    ativo: true,
    snapshots: [
      { date: '01/04', seguidores: 184000, total_posts: 1240, engajamento_taxa: 6.4, posts_semana: 10 },
      { date: '15/04', seguidores: 191000, total_posts: 1268, engajamento_taxa: 6.7, posts_semana: 10 },
      { date: '29/04', seguidores: 198500, total_posts: 1294, engajamento_taxa: 6.9, posts_semana: 10,
        seguidores_tiktok: 312000, seguidores_youtube: 48000, seguidores_facebook: 22000,
        reclame_aqui_nota: 0, reclame_aqui_reclamacoes: 0, reclame_aqui_resolvidas_pct: 0 },
    ],
    content: [
      { id:'ctr1', tipo:'REEL', tag:'tutorial', tema:'Técnica de mechas que viralizou', data_publicado:'2026-04-25', curtidas:42800, comentarios:3100, engajamento_taxa:18.2, formato_nota:'Referência de formato: tutorial acelerado com texto grande na tela e payoff no fim.', gancho:'resultado', emocao:'surpresa', audio:'trend', ritmo_edicao:'cortes-rapidos', validado:true },
      { id:'ctr2', tipo:'REEL', tag:'dica', tema:'O que ninguém te conta sobre loiro', data_publicado:'2026-04-18', curtidas:28400, comentarios:1980, engajamento_taxa:15.6, formato_nota:'Gancho de "segredo" + entrega rápida de valor. Modelo replicável.', gancho:'choque', emocao:'curiosidade', audio:'original', ritmo_edicao:'cortes-rapidos', validado:true },
    ],
  },
]

function loadFallback(): Competitor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Competitor[]) : MOCK_COMPETITORS
  } catch { return MOCK_COMPETITORS }
}

function saveFallback(list: Competitor[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

// Último snapshot + cálculo de delta
export function latestSnapshot(competitor: Competitor): LatestSnapshot | null {
  const snaps = competitor.snapshots || []
  if (!snaps.length) return null
  const sorted = [...snaps].sort((a, b) => snapKey(a.date) - snapKey(b.date))
  const last = sorted[sorted.length - 1]
  const first = sorted[0]
  return {
    ...last,
    seguidores_delta: last.seguidores - first.seguidores,
    series: sorted,
  }
}

function snapKey(d: string): number {
  // 'DD/MM' → número ordenável
  const [day, mon] = String(d).split('/').map(Number)
  return (mon || 0) * 100 + (day || 0)
}

export interface UseCompetitorsReturn {
  competitors: Competitor[]
  loading: boolean
  usingLocal: boolean
  addCompetitor: (payload: CompetitorPayload) => Promise<{ error: Error | null }>
  removeCompetitor: (id: string) => Promise<{ error: Error | null }>
  addSnapshot: (competitorId: string, snap: Partial<CompetitorSnapshot> & { date?: string }) => Promise<{ error: Error | null }>
  addContent: (competitorId: string, content: Partial<CompetitorContent>) => Promise<{ error: Error | null }>
  removeContent: (competitorId: string, contentId: string) => Promise<{ error: Error | null }>
  refresh: () => Promise<void>
  SNAP_DATES: string[]
}

export function useCompetitors(): UseCompetitorsReturn {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [usingLocal, setUsingLocal] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data: comps, error } = await supabase
        .from('competitors')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error

      if (!comps?.length) {
        setCompetitors(loadFallback())
        setUsingLocal(true)
      } else {
        const ids = comps.map(c => c.id)
        const [snapRes, contentRes] = await Promise.all([
          supabase.from('competitor_snapshots').select('*').in('competitor_id', ids),
          supabase.from('competitor_content').select('*').in('competitor_id', ids),
        ])
        const byComp: Record<string, CompetitorSnapshot[]> = {}
        ;(snapRes.data || []).forEach(s => {
          const k = s.competitor_id
          if (!byComp[k]) byComp[k] = []
          byComp[k].push({
            date: new Date(s.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
            seguidores: s.seguidores,
            total_posts: s.total_posts,
            engajamento_taxa: Number(s.engajamento_taxa),
            posts_semana: Number(s.posts_semana),
            seguidores_tiktok: s.seguidores_tiktok || 0,
            seguidores_youtube: s.seguidores_youtube || 0,
            seguidores_facebook: s.seguidores_facebook || 0,
            reclame_aqui_nota: Number(s.reclame_aqui_nota) || 0,
            reclame_aqui_reclamacoes: s.reclame_aqui_reclamacoes || 0,
            reclame_aqui_resolvidas_pct: Number(s.reclame_aqui_resolvidas_pct) || 0,
            observacoes: s.observacoes,
          })
        })
        const contentByComp: Record<string, CompetitorContent[]> = {}
        ;(contentRes.data || []).forEach(ct => {
          const k = ct.competitor_id
          if (!contentByComp[k]) contentByComp[k] = []
          contentByComp[k].push({
            id: ct.id,
            tipo: ct.tipo,
            tag: ct.tag,
            tema: ct.tema,
            permalink: ct.permalink,
            data_publicado: ct.data_publicado,
            curtidas: ct.curtidas,
            comentarios: ct.comentarios,
            engajamento_taxa: Number(ct.engajamento_taxa),
            formato_nota: ct.formato_nota,
            gancho: ct.gancho,
            emocao: ct.emocao,
            audio: ct.audio,
            ritmo_edicao: ct.ritmo_edicao,
            validado: ct.validado,
          })
        })
        setCompetitors(comps.map(c => ({
          ...c,
          snapshots: byComp[c.id] || [],
          content: contentByComp[c.id] || [],
        })))
        setUsingLocal(false)
      }
    } catch {
      setCompetitors(loadFallback())
      setUsingLocal(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function addCompetitor(payload: CompetitorPayload) {
    const row = {
      nome: payload.nome,
      handle: payload.handle,
      segmento: payload.segmento,
      website: payload.website,
      cor: payload.cor,
      tipo: payload.tipo || 'concorrente',
      ativo: true,
    }
    if (usingLocal) {
      const next: Competitor[] = [...competitors, { id: 'c' + Date.now(), ...row, ativo: true, snapshots: [], content: [] }]
      setCompetitors(next); saveFallback(next)
      return { error: null }
    }
    const { data, error } = await supabase.from('competitors').insert(row).select().single()
    if (!error) setCompetitors(c => [...c, { ...(data as Competitor), snapshots: [], content: [] }])
    return { error }
  }

  async function removeCompetitor(id: string) {
    if (usingLocal) {
      const next = competitors.filter(c => c.id !== id)
      setCompetitors(next); saveFallback(next)
      return { error: null }
    }
    const { error } = await supabase.from('competitors').delete().eq('id', id)
    if (!error) setCompetitors(c => c.filter(x => x.id !== id))
    return { error }
  }

  async function addSnapshot(competitorId: string, snap: Partial<CompetitorSnapshot> & { date?: string }) {
    const num = (k: keyof CompetitorSnapshot): number => Number(snap[k]) || 0
    const entry: CompetitorSnapshot = {
      date: snap.date || new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
      seguidores: num('seguidores'),
      total_posts: num('total_posts'),
      engajamento_taxa: num('engajamento_taxa'),
      posts_semana: num('posts_semana'),
      seguidores_tiktok: num('seguidores_tiktok'),
      seguidores_youtube: num('seguidores_youtube'),
      seguidores_facebook: num('seguidores_facebook'),
      reclame_aqui_nota: num('reclame_aqui_nota'),
      reclame_aqui_reclamacoes: num('reclame_aqui_reclamacoes'),
      reclame_aqui_resolvidas_pct: num('reclame_aqui_resolvidas_pct'),
      observacoes: snap.observacoes || '',
    }
    if (usingLocal) {
      const next = competitors.map(c =>
        c.id === competitorId
          ? { ...c, snapshots: [...(c.snapshots || []).filter(s => s.date !== entry.date), entry] }
          : c
      )
      setCompetitors(next); saveFallback(next)
      return { error: null }
    }
    const { date, ...cols } = entry
    const { error } = await supabase.from('competitor_snapshots').upsert({
      competitor_id: competitorId,
      ...cols,
    }, { onConflict: 'competitor_id,date' })
    if (!error) await fetchAll()
    return { error }
  }

  async function addContent(competitorId: string, content: Partial<CompetitorContent>) {
    const entry: Omit<CompetitorContent, 'id'> = {
      tipo: content.tipo || 'REEL',
      tag: content.tag || 'tendencia',
      tema: content.tema,
      permalink: content.permalink || '',
      data_publicado: content.data_publicado || null,
      curtidas: Number(content.curtidas) || 0,
      comentarios: Number(content.comentarios) || 0,
      engajamento_taxa: Number(content.engajamento_taxa) || 0,
      formato_nota: content.formato_nota || '',
      gancho: content.gancho || null,
      emocao: content.emocao || null,
      audio: content.audio || null,
      ritmo_edicao: content.ritmo_edicao || null,
      validado: true,
    }
    if (usingLocal) {
      const next = competitors.map(c =>
        c.id === competitorId
          ? { ...c, content: [{ id: 'ct' + Date.now(), ...entry }, ...(c.content || [])] }
          : c
      )
      setCompetitors(next); saveFallback(next)
      return { error: null }
    }
    const { error } = await supabase
      .from('competitor_content')
      .insert({ competitor_id: competitorId, ...entry })
    if (!error) await fetchAll()
    return { error }
  }

  async function removeContent(competitorId: string, contentId: string) {
    if (usingLocal) {
      const next = competitors.map(c =>
        c.id === competitorId
          ? { ...c, content: (c.content || []).filter(ct => ct.id !== contentId) }
          : c
      )
      setCompetitors(next); saveFallback(next)
      return { error: null }
    }
    const { error } = await supabase.from('competitor_content').delete().eq('id', contentId)
    if (!error) await fetchAll()
    return { error }
  }

  return {
    competitors, loading, usingLocal,
    addCompetitor, removeCompetitor, addSnapshot,
    addContent, removeContent,
    refresh: fetchAll, SNAP_DATES,
  }
}
