import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { supabase, invokeFunction } from '@/shared/lib/supabase'
import { TIMEOUTS } from '@/shared/lib/config'
import type { AdsPayload, AdsPeriod, Goal } from '@/features/ads/api/types'

// ============================================================================
// Tipos públicos do contexto
// ============================================================================

export interface IgAccount {
  username: string
  seguidores: number
  seguidores_delta_30d: number
  seguindo?: number
  total_posts?: number
  alcance_dia?: number
  impressoes_dia?: number
  visitas_perfil?: number
  cliques_site?: number
  engajamento_taxa?: number
  serie_seguidores: Array<{ date: string; value: number }>
  serie_engajamento: Array<{ date: string; value: number }>
  serie_alcance: Array<{ date: string; value: number }>
}

export interface IgPost {
  id: string
  tipo: 'REEL' | 'IMAGE' | 'CAROUSEL' | 'CAROUSEL_ALBUM' | 'STORY'
  caption: string
  thumbnail_url: string
  publicado_em: string
  curtidas: number
  comentarios: number
  salvamentos: number
  compartilhamentos: number
  alcance: number
  plays: number
  engajamento_taxa: number
  ig_post_id?: string
  exits?: number
  replies?: number
}

export interface IgData {
  account: IgAccount
  posts: IgPost[]
}

export interface IgSyncResult {
  ok: boolean
  msg: string
}

export interface MetricsContextValue {
  // Ads
  adsByPeriod: Partial<Record<AdsPeriod, AdsPayload>>
  adsLoading: Partial<Record<AdsPeriod, boolean>>
  loadAds: (period: AdsPeriod) => Promise<AdsPayload>
  // Instagram
  ig: IgData | null
  igLoading: boolean
  igUsingMock: boolean
  refreshIg: () => Promise<void>
  triggerIgSync: () => Promise<IgSyncResult>
  // Goals
  goals: Goal[]
  goalsLoading: boolean
  updateGoal: (key: string, patch: Partial<Goal>) => Promise<void>
  refreshGoals: () => Promise<void>
}

// ============================================================================

const MetricsContext = createContext<MetricsContextValue | null>(null)

// === MOCKS para Ads (mesmos que estavam em useMetrics.js) ===

const ADS_MOCK: Record<AdsPeriod, AdsPayload> = {
  hoje: {
    roas: 4.2, roi: 320, ctrMeta: 3.8, ctrGoogle: 5.1,
    mensagens: 148, vendas: 37, agendamentos: 63, investimento: 890,
    receita: 3738,
    funil: { impressoes: 12400, cliques: 547, mensagens: 148, agendamentos: 63, vendas: 37 },
    campanhas: [
      { id:1, nome:'Salão — Promoção Verão', plataforma:'Meta', tipo:'CTWA', investido:320, impressoes:5200, ctr:4.1, mensagens:72, agendamentos:31, vendas:18, roas:5.1, status:'ativo' },
      { id:2, nome:'Salão — Retargeting',    plataforma:'Meta', tipo:'API Conv.', investido:196, impressoes:3100, ctr:3.3, mensagens:76, agendamentos:32, vendas:19, roas:4.8, status:'ativo' },
      { id:3, nome:'Salão BH — Pesquisa',   plataforma:'Google', tipo:'API Conv.', investido:240, impressoes:2800, ctr:6.2, mensagens:0, agendamentos:0, vendas:0, roas:4.7, status:'ativo' },
      { id:4, nome:'Salão BH — Display',    plataforma:'Google', tipo:'API Conv.', investido:134, impressoes:1300, ctr:3.8, mensagens:0, agendamentos:0, vendas:0, roas:2.9, status:'revisar' },
    ],
    chartRoas: { labels:['Meta Ads','Google Ads'], hoje:[4.1,4.4], ontem:[3.8,4.2] },
    chartConv: {
      labels:['08h','09h','10h','11h','12h','13h','14h','15h','16h','17h'],
      mensagens:[8,14,18,22,16,19,24,13,9,5],
      agendamentos:[3,6,8,9,7,8,10,6,4,2],
      vendas:[2,3,5,6,4,5,6,4,2,0],
    },
    chartCtr: {
      labels:['08h','09h','10h','11h','12h','13h','14h','15h','16h','17h'],
      meta:[3.1,3.6,4.2,4.5,3.9,3.7,4.0,3.6,3.2,2.9],
      google:[4.2,5.0,5.8,6.1,5.3,5.0,5.4,4.9,4.4,3.8],
    },
    budget: { meta: 516, google: 374 },
  },
  semana: {
    roas: 3.9, roi: 290, ctrMeta: 3.6, ctrGoogle: 4.8,
    mensagens: 982, vendas: 241, agendamentos: 412, investimento: 6230,
    receita: 24297,
    funil: { impressoes: 84300, cliques: 3680, mensagens: 982, agendamentos: 412, vendas: 241 },
    campanhas: [
      { id:1, nome:'Salão — Promoção Verão', plataforma:'Meta',   tipo:'CTWA',      investido:2240, impressoes:36400, ctr:3.9, mensagens:498, agendamentos:212, vendas:124, roas:4.9, status:'ativo' },
      { id:2, nome:'Salão — Retargeting',    plataforma:'Meta',   tipo:'API Conv.', investido:1372, impressoes:21700, ctr:3.2, mensagens:484, agendamentos:200, vendas:117, roas:4.6, status:'ativo' },
      { id:3, nome:'Salão BH — Pesquisa',    plataforma:'Google', tipo:'API Conv.', investido:1680, impressoes:19600, ctr:6.0, mensagens:0,   agendamentos:0,   vendas:0,   roas:4.5, status:'ativo' },
      { id:4, nome:'Salão BH — Display',     plataforma:'Google', tipo:'API Conv.', investido:938,  impressoes:9100,  ctr:3.5, mensagens:0,   agendamentos:0,   vendas:0,   roas:2.6, status:'revisar' },
    ],
    chartRoas: { labels:['Meta Ads','Google Ads'], hoje:[3.8,4.1], ontem:[3.5,4.0] },
    chartConv: {
      labels:['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'],
      mensagens:   [124, 152, 168, 145, 174, 132, 87],
      agendamentos:[ 52,  64,  72,  60,  74,  56, 34],
      vendas:      [ 30,  38,  42,  35,  44,  32, 20],
    },
    chartCtr: {
      labels:['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'],
      meta:  [3.4, 3.7, 3.9, 3.5, 4.0, 3.3, 2.9],
      google:[4.5, 4.9, 5.1, 4.6, 5.3, 4.4, 4.0],
    },
    budget: { meta: 3612, google: 2618 },
  },
  mes: {
    roas: 3.7, roi: 271, ctrMeta: 3.5, ctrGoogle: 4.6,
    mensagens: 4180, vendas: 1024, agendamentos: 1742, investimento: 26800,
    receita: 99160,
    funil: { impressoes: 358000, cliques: 15640, mensagens: 4180, agendamentos: 1742, vendas: 1024 },
    campanhas: [
      { id:1, nome:'Salão — Promoção Verão', plataforma:'Meta',   tipo:'CTWA',      investido:9620, impressoes:155400, ctr:3.8, mensagens:2110, agendamentos:898, vendas:528, roas:4.7, status:'ativo' },
      { id:2, nome:'Salão — Retargeting',    plataforma:'Meta',   tipo:'API Conv.', investido:5890, impressoes: 92800, ctr:3.1, mensagens:2070, agendamentos:844, vendas:496, roas:4.4, status:'ativo' },
      { id:3, nome:'Salão BH — Pesquisa',    plataforma:'Google', tipo:'API Conv.', investido:7240, impressoes: 84200, ctr:5.9, mensagens:   0, agendamentos:  0, vendas:  0, roas:4.3, status:'ativo' },
      { id:4, nome:'Salão BH — Display',     plataforma:'Google', tipo:'API Conv.', investido:4050, impressoes: 39600, ctr:3.4, mensagens:   0, agendamentos:  0, vendas:  0, roas:2.4, status:'revisar' },
    ],
    chartRoas: { labels:['Meta Ads','Google Ads'], hoje:[3.6,3.9], ontem:[3.3,3.8] },
    chartConv: {
      labels:['Sem 1','Sem 2','Sem 3','Sem 4'],
      mensagens:   [ 982, 1080, 1056, 1062],
      agendamentos:[ 412,  450,  438,  442],
      vendas:      [ 241,  268,  254,  261],
    },
    chartCtr: {
      labels:['Sem 1','Sem 2','Sem 3','Sem 4'],
      meta:  [3.6, 3.5, 3.4, 3.5],
      google:[4.8, 4.7, 4.5, 4.6],
    },
    budget: { meta: 15510, google: 11290 },
  },
}

// === MOCKS para Instagram ===

const recentISO = (hoursAgo: number): string => {
  const d = new Date()
  d.setHours(d.getHours() - hoursAgo)
  return d.toISOString()
}

const IG_MOCK_ACCOUNT: IgAccount = {
  username: '@salao.bella',
  seguidores: 12480,
  seguidores_delta_30d: 312,
  seguindo: 384,
  total_posts: 287,
  alcance_dia: 5840,
  impressoes_dia: 9120,
  visitas_perfil: 412,
  cliques_site: 38,
  engajamento_taxa: 4.6,
  serie_seguidores: [
    { date: '01/04', value: 12168 }, { date: '05/04', value: 12190 },
    { date: '10/04', value: 12245 }, { date: '15/04', value: 12298 },
    { date: '20/04', value: 12354 }, { date: '25/04', value: 12411 },
    { date: '30/04', value: 12480 },
  ],
  serie_engajamento: [
    { date: 'Sem 1', value: 3.8 }, { date: 'Sem 2', value: 4.1 },
    { date: 'Sem 3', value: 4.4 }, { date: 'Sem 4', value: 4.6 },
  ],
  serie_alcance: [
    { date: 'Seg', value: 4200 }, { date: 'Ter', value: 5100 },
    { date: 'Qua', value: 6300 }, { date: 'Qui', value: 5800 },
    { date: 'Sex', value: 7200 }, { date: 'Sáb', value: 5400 },
    { date: 'Dom', value: 5840 },
  ],
}

const IG_MOCK_POSTS: IgPost[] = [
  { id:'p0', tipo:'REEL',           caption:'BOMBOU 🔥 Cliente raspou tudo e fez Pixie Cut — o resultado foi ESSE',
    thumbnail_url:'', publicado_em: recentISO(18),
    curtidas: 8420, comentarios: 642, salvamentos: 1890, compartilhamentos: 1247,
    alcance: 89400, plays: 142800, engajamento_taxa: 13.6 },
  { id:'p1', tipo:'REEL',           caption:'Antes e depois — escova progressiva 💁‍♀️',          thumbnail_url:'', publicado_em: recentISO(36),  curtidas:1248, comentarios:142, salvamentos:289, compartilhamentos:178, alcance:18420, plays:24890, engajamento_taxa:9.6 },
  { id:'p2', tipo:'CAROUSEL_ALBUM', caption:'10 dicas pra cuidar do cabelo no inverno ❄️',       thumbnail_url:'', publicado_em: recentISO(74),  curtidas: 842, comentarios: 67, salvamentos:412, compartilhamentos: 89, alcance:11200, plays:    0, engajamento_taxa:7.2 },
  { id:'p3', tipo:'IMAGE',          caption:'Promo do mês — corte + hidratação por R$89',         thumbnail_url:'', publicado_em: recentISO(150), curtidas: 612, comentarios: 38, salvamentos: 94, compartilhamentos: 42, alcance: 8400, plays:    0, engajamento_taxa:5.1 },
  { id:'p4', tipo:'REEL',           caption:'Coloração francesa — passo a passo',                  thumbnail_url:'', publicado_em: recentISO(220), curtidas: 980, comentarios: 78, salvamentos:198, compartilhamentos:124, alcance:14300, plays:18750, engajamento_taxa:8.0 },
  { id:'p5', tipo:'IMAGE',          caption:'Cliente do dia 💖 #salao #beleza',                    thumbnail_url:'', publicado_em: recentISO(280), curtidas: 412, comentarios: 22, salvamentos: 18, compartilhamentos: 11, alcance: 5200, plays:    0, engajamento_taxa:3.6 },
  { id:'p6', tipo:'REEL',           caption:'Tendência: morena iluminada 🍯',                     thumbnail_url:'', publicado_em: recentISO(340), curtidas:1102, comentarios:  98, salvamentos:241, compartilhamentos:152, alcance:15800, plays:21200, engajamento_taxa:8.6 },
  { id:'p7', tipo:'STORY',          caption:'Story: bastidor do salão',                            thumbnail_url:'', publicado_em: recentISO(8),   curtidas:   0, comentarios:   0, salvamentos:  0, compartilhamentos:  0, alcance: 3120, plays:    0, exits:182, replies:14, engajamento_taxa:0 },
]

const IG_MOCK: IgData = { account: IG_MOCK_ACCOUNT, posts: IG_MOCK_POSTS }

const GOALS_FALLBACK: Goal[] = [
  { key: 'roas',         label: 'ROAS mínimo',             unit: 'x',     value: 3.5,  enabled: true },
  { key: 'ctr',          label: 'CTR mínimo',              unit: '%',     value: 2.5,  enabled: true },
  { key: 'mensagens',    label: 'Mensagens por dia',       unit: 'msgs',  value: 100,  enabled: true },
  { key: 'agendamentos', label: 'Agendamentos por semana', unit: 'agend', value: 50,   enabled: false },
  { key: 'vendas',       label: 'Vendas aprovadas/dia',    unit: 'vnd',   value: 25,   enabled: true },
  { key: 'budget',       label: 'Alerta de orçamento',     unit: '%',     value: 80,   enabled: true },
]
const GOAL_ORDER = ['roas','ctr','mensagens','agendamentos','vendas','budget']

// === Provider ===

interface MetricsProviderProps {
  children: ReactNode
}

export function MetricsProvider({ children }: MetricsProviderProps) {
  // Ads metrics — cache por período
  const [adsByPeriod, setAdsByPeriod] = useState<Partial<Record<AdsPeriod, AdsPayload>>>({})
  const [adsLoading, setAdsLoading] = useState<Partial<Record<AdsPeriod, boolean>>>({})

  // Instagram
  const [ig, setIg] = useState<IgData | null>(null)
  const [igLoading, setIgLoading] = useState(true)
  const [igUsingMock, setIgUsingMock] = useState(false)

  // Goals
  const [goals, setGoals] = useState<Goal[]>(GOALS_FALLBACK)
  const [goalsLoading, setGoalsLoading] = useState(true)

  // === Ads ===

  const loadAds = useCallback(async (period: AdsPeriod): Promise<AdsPayload> => {
    const cached = adsByPeriod[period]
    if (cached) return cached
    setAdsLoading(s => ({ ...s, [period]: true }))
    try {
      const { data: rows, error } = await supabase
        .from('daily_metrics')
        .select('*')
        .eq('period', period)
        .order('created_at', { ascending: false })
        .limit(1)
      const payload: AdsPayload = (error || !rows?.length)
        ? (ADS_MOCK[period] ?? ADS_MOCK.hoje)
        : (rows[0].payload as AdsPayload)
      setAdsByPeriod(s => ({ ...s, [period]: payload }))
      return payload
    } catch {
      const payload = ADS_MOCK[period] ?? ADS_MOCK.hoje
      setAdsByPeriod(s => ({ ...s, [period]: payload }))
      return payload
    } finally {
      setAdsLoading(s => ({ ...s, [period]: false }))
    }
  }, [adsByPeriod])

  // === Instagram ===

  const loadIg = useCallback(async (): Promise<void> => {
    setIgLoading(true)
    try {
      const [accountRes, postsRes] = await Promise.all([
        supabase.from('instagram_account_metrics').select('*').order('date', { ascending: false }).limit(30),
        supabase.from('instagram_posts').select('*').order('publicado_em', { ascending: false }).limit(20),
      ])
      const accountRows = accountRes.data
      const posts = postsRes.data as IgPost[] | null

      if (accountRes.error || !accountRows?.length) {
        setIg(IG_MOCK)
        setIgUsingMock(true)
      } else {
        const latest = accountRows[0]
        const oldest = accountRows[accountRows.length - 1]
        const serie_seguidores = [...accountRows].reverse().map(r => ({
          date: new Date(r.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }),
          value: r.seguidores,
        }))
        setIg({
          account: {
            username: latest.username || '@conta',
            seguidores: latest.seguidores,
            seguidores_delta_30d: latest.seguidores - (oldest?.seguidores ?? latest.seguidores),
            seguindo: latest.seguindo,
            total_posts: latest.total_posts,
            alcance_dia: latest.alcance_dia,
            impressoes_dia: latest.impressoes_dia,
            visitas_perfil: latest.visitas_perfil,
            cliques_site: latest.cliques_site,
            engajamento_taxa: latest.engajamento_taxa,
            serie_seguidores,
            serie_engajamento: IG_MOCK_ACCOUNT.serie_engajamento,
            serie_alcance:     IG_MOCK_ACCOUNT.serie_alcance,
          },
          posts: posts || [],
        })
        setIgUsingMock(false)
      }
    } catch {
      setIg(IG_MOCK)
      setIgUsingMock(true)
    } finally {
      setIgLoading(false)
    }
  }, [])

  const triggerIgSync = useCallback(async (): Promise<IgSyncResult> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: a sincronização demorou demais.')), TIMEOUTS.edgeFunctionMs)
      )
      const result = await Promise.race([
        invokeFunction<{ message?: string }>('instagram-sync'),
        timeoutPromise,
      ])
      const { data, error } = result
      if (error) return { ok: false, msg: error.message }
      await loadIg()
      return { ok: true, msg: data?.message || 'Sincronização concluída.' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao invocar instagram-sync.'
      return { ok: false, msg }
    }
  }, [loadIg])

  // === Goals ===

  const loadGoals = useCallback(async (): Promise<void> => {
    setGoalsLoading(true)
    try {
      const { data, error } = await supabase.from('goals').select('*')
      if (error || !data?.length) {
        setGoals(GOALS_FALLBACK)
      } else {
        const sorted = [...(data as Goal[])].sort(
          (a, b) => GOAL_ORDER.indexOf(a.key) - GOAL_ORDER.indexOf(b.key),
        )
        setGoals(sorted)
      }
    } catch {
      setGoals(GOALS_FALLBACK)
    } finally {
      setGoalsLoading(false)
    }
  }, [])

  const updateGoal = useCallback(async (key: string, patch: Partial<Goal>): Promise<void> => {
    setGoals(gs => gs.map(g => g.key === key ? { ...g, ...patch } : g))
    await supabase.from('goals').update(patch).eq('key', key)
  }, [])

  // Bootstrap único
  useEffect(() => {
    loadAds('hoje')
    loadIg()
    loadGoals()
  }, [loadIg, loadGoals]) // loadAds intencionalmente fora — gerenciado abaixo

  const value = useMemo<MetricsContextValue>(() => ({
    // Ads
    adsByPeriod,
    adsLoading,
    loadAds,
    // Instagram
    ig,
    igLoading,
    igUsingMock,
    refreshIg: loadIg,
    triggerIgSync,
    // Goals
    goals,
    goalsLoading,
    updateGoal,
    refreshGoals: loadGoals,
  }), [adsByPeriod, adsLoading, loadAds, ig, igLoading, igUsingMock, loadIg, triggerIgSync, goals, goalsLoading, updateGoal, loadGoals])

  return <MetricsContext.Provider value={value}>{children}</MetricsContext.Provider>
}

export function useMetricsContext(): MetricsContextValue {
  const ctx = useContext(MetricsContext)
  if (!ctx) throw new Error('useMetricsContext deve ser usado dentro de <MetricsProvider>')
  return ctx
}
