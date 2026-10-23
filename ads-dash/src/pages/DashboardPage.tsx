import { useState, useMemo } from 'react'
import { useAuth } from '@/app/providers/AuthContext'
import { useMetrics } from '@/features/ads/hooks/useMetrics'
import { useInstagramMetrics } from '@/features/organic/instagram/hooks/useInstagramMetrics'
import { useWhatsAppMetrics } from '@/features/whatsapp'
import { useMetas } from '@/features/metas/hooks/useMetas'
import { useDailyMetrics, previousRange, deltaPct } from '@/features/ads/hooks/useDailyMetrics'
import { detectHype, HYPE_LEVELS } from '@/features/organic/instagram/lib/hypeDetector'
import { detectAnomalies } from '@/lib/anomalies'
import { fmtNumber, fmtRoas, fmtDelta, fmtBRL, fmtPct } from '@/shared/lib/format'
import { buildMetricExplain } from '@/shared/lib/metricDefinitions'
import Tabs from '@/components/ui/Tabs'
import KpiCard from '@/shared/ui/KpiCard'
import WeeklyBriefing from '@/components/ui/WeeklyBriefing'
import HealthScore from '@/components/ui/HealthScore'
import QuarterlyGoals from '@/components/ui/QuarterlyGoals'
import GoalTracker from '@/components/ui/GoalTracker'
import FunnelBar from '@/shared/ui/FunnelBar'
import CampaignTable from '@/features/ads/components/CampaignTable'
import RoasChart from '@/features/ads/components/RoasChart'
import ConvChart from '@/features/ads/components/ConvChart'
import CtrChart from '@/features/ads/components/CtrChart'
import BudgetChart from '@/features/ads/components/BudgetChart'
import DateRangePicker, { fromPreset } from '@/shared/ui/DateRangePicker'
import CalendarView from '@/components/ui/CalendarView'
import PeriodComparison from '@/components/ui/PeriodComparison'
import MetricExplainer from '@/shared/ui/MetricExplainer'
import JourneyTimeline from '@/components/ui/JourneyTimeline'
import BriefingModal from '@/components/ui/BriefingModal'
import styles from './DashboardPage.module.css'

const TABS = [
  { id: 'atencao',    label: 'Atenção agora' },
  { id: 'jornada',    label: 'Jornada' },
  { id: 'metas',      label: 'Metas' },
  { id: 'calendario', label: 'Calendário' },
  { id: 'comparar',   label: 'Comparar' },
  { id: 'campanhas',  label: 'Campanhas' },
]

function greeting(name) {
  const h = new Date().getHours()
  const time = h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return name ? `${time}, ${name}` : time
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('atencao')
  const [range, setRange] = useState(() => fromPreset('7'))
  const [rangeA, setRangeA] = useState(() => fromPreset('7'))
  const [rangeB, setRangeB] = useState(() => previousRange(fromPreset('7')))
  const [explainKey, setExplainKey] = useState(null)
  const [showBriefing, setShowBriefing] = useState(false)

  const { summary, days: dailyDays, usingMock } = useDailyMetrics(range)
  const prev = useMemo(() => previousRange(range), [range?.from?.getTime?.(), range?.to?.getTime?.()])
  const { summary: prevSummary } = useDailyMetrics(prev)
  const period = useMemo(() => mapRangeToPeriod(range), [range?.from?.getTime?.(), range?.to?.getTime?.()])
  const { data } = useMetrics(period)
  const { data: ig } = useInstagramMetrics()
  const { data: wa } = useWhatsAppMetrics()
  const { metas } = useMetas({ periodo: 'mes' })
  const { topHype, hypePosts } = detectHype(ig?.posts, ig?.account)
  const anomalies = useMemo(() => detectAnomalies(dailyDays), [dailyDays])

  const firstName = (profile?.full_name || user?.email?.split('@')[0] || '').split(' ')[0]
  const attentionCount = anomalies.length + (topHype ? 1 : 0)

  // Hero data — Faturamento do mês atual, da tabela de metas.
  const faturamento = metas.find(m => m.kpi === 'faturamento')
  const investimento = metas.find(m => m.kpi === 'investimento_ads')
  const faturamentoPct = faturamento && faturamento.valor_meta > 0
    ? (faturamento.valor_realizado / faturamento.valor_meta) * 100
    : 0

  const serieFor = key => (dailyDays || []).map(d => Number(d[key]) || 0)
  const explain = useMemo(
    () => explainKey ? buildMetricExplain(explainKey, { summary, prev: prevSummary, days: dailyDays }) : null,
    [explainKey, summary, prevSummary, dailyDays]
  )

  const tabsWithBadges = useMemo(() => TABS.map(t =>
    t.id === 'atencao' && attentionCount > 0 ? { ...t, badge: attentionCount } : t
  ), [attentionCount])

  return (
    <div className={styles.page}>
      {/* Topbar compacto — 1 linha, saudação pequena, ações à direita */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <h1 className={styles.pageTitle}>{greeting(firstName)}</h1>
          <SourcePill usingMock={usingMock} />
        </div>
        <div className={styles.topBarActions}>
          <button className={styles.ghostBtn} onClick={() => setShowBriefing(true)}>
            Briefing <kbd className={styles.kbd}>B</kbd>
          </button>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>

      <Tabs items={tabsWithBadges} activeId={tab} onChange={setTab} accentColor="var(--section-dashboard)" />

      {tab === 'atencao' && summary && (
        <>
          {/* HERO — Faturamento do mês com progress bar da meta */}
          <section className={styles.hero}>
            <div className={styles.heroPrimary}>
              <span className={styles.heroLabel}>Faturamento · mês atual</span>
              <div className={styles.heroValueWrap}>
                <span className={styles.heroValue}>
                  {faturamento ? fmtBRL(faturamento.valor_realizado) : 'R$ 0'}
                </span>
                <span className={`${styles.heroDelta} ${deltaClass(faturamentoPct)}`}>
                  {faturamentoPct >= 100 ? '▲' : '▸'} {faturamentoPct.toFixed(0)}% da meta
                </span>
              </div>
              {faturamento && faturamento.valor_meta > 0 && (
                <div className={styles.metaProgress}>
                  <div className={styles.metaProgressTrack}>
                    <div
                      className={styles.metaProgressFill}
                      style={{ width: `${Math.min(100, faturamentoPct)}%` }}
                    />
                    {faturamentoPct > 100 && (
                      <div
                        className={styles.metaProgressOverflow}
                        style={{ width: `${Math.min(100, faturamentoPct - 100)}%` }}
                      />
                    )}
                  </div>
                  <div className={styles.metaProgressRow}>
                    <span className={styles.metaRealizado}>
                      {fmtBRL(faturamento.valor_realizado)}
                    </span>
                    <span className={styles.metaAlvo}>
                      meta <strong>{fmtBRL(faturamento.valor_meta)}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {investimento && investimento.valor_meta > 0 && (
              <div className={styles.heroSide}>
                <span className={styles.heroSideLabel}>Investimento</span>
                <span className={styles.heroSideValue}>{fmtBRL(investimento.valor_realizado)}</span>
                <span className={styles.heroSideSub}>
                  de {fmtBRL(investimento.valor_meta)} orçado
                </span>
                <div className={styles.heroSideBar}>
                  <div
                    className={styles.heroSideBarFill}
                    style={{ width: `${Math.min(100, (investimento.valor_realizado / investimento.valor_meta) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* 4 KPIs secundários inline (KpiCard atualizado globalmente) */}
          <section className={styles.secondaryRow}>
            <KpiCard
              label="ROAS"
              value={fmtRoas(summary.roas)}
              delta={renderDelta(summary.roas, prevSummary?.roas, '%')}
              up={summary.roas >= (prevSummary?.roas || 0)}
              neutral={!prevSummary?.roas}
              serie={serieFor('roas')}
              onClick={() => setExplainKey('roas')}
              accentColor="var(--section-dashboard)"
            />
            <KpiCard
              label="Conversas"
              value={fmtNumber(summary.mensagens)}
              delta={renderDelta(summary.mensagens, prevSummary?.mensagens)}
              up={summary.mensagens >= (prevSummary?.mensagens || 0)}
              neutral={!prevSummary?.mensagens}
              serie={serieFor('mensagens')}
              onClick={() => setExplainKey('mensagens')}
            />
            <KpiCard
              label="Agendamentos"
              value={fmtNumber(summary.agendamentos)}
              delta={renderDelta(summary.agendamentos, prevSummary?.agendamentos)}
              up={summary.agendamentos >= (prevSummary?.agendamentos || 0)}
              neutral={!prevSummary?.agendamentos}
              serie={serieFor('agendamentos')}
              onClick={() => setExplainKey('agendamentos')}
            />
            <KpiCard
              label="Vendas"
              value={fmtNumber(summary.vendas)}
              delta={renderDelta(summary.vendas, prevSummary?.vendas)}
              up={summary.vendas >= (prevSummary?.vendas || 0)}
              neutral={!prevSummary?.vendas}
              serie={serieFor('vendas')}
              onClick={() => setExplainKey('vendas')}
            />
          </section>

          <AttentionList anomalies={anomalies} hype={topHype} hypeCount={hypePosts.length} />

          {/* Briefing + Health Score abaixo, auxiliares */}
          <section className={styles.auxGrid}>
            <div className={styles.auxCard}>
              <WeeklyBriefing summary={summary} prev={prevSummary} ig={ig} />
            </div>
            <div className={styles.auxCard}>
              <HealthScore summary={summary} prev={prevSummary} ig={ig} whatsapp={wa} />
            </div>
          </section>
        </>
      )}

      {tab === 'jornada' && <JourneyTimeline />}

      {tab === 'metas' && (
        <>
          <section className={styles.section}>
            <h2 className={styles.h2}>Metas operacionais</h2>
            <GoalTracker />
          </section>
          <section className={styles.section}>
            <h2 className={styles.h2}>Metas trimestrais</h2>
            <QuarterlyGoals />
          </section>
        </>
      )}

      {tab === 'calendario' && <CalendarView />}

      {tab === 'comparar' && (
        <>
          <div className={styles.compareControls}>
            <div className={styles.compareCol}>
              <label className={styles.compareLabel}>Período A (atual)</label>
              <DateRangePicker value={rangeA} onChange={setRangeA} />
            </div>
            <div className={styles.compareCol}>
              <label className={styles.compareLabel}>Período B (referência)</label>
              <DateRangePicker value={rangeB} onChange={setRangeB} />
            </div>
            <button className="btn" onClick={() => setRangeB(previousRange(rangeA))}>
              ⇄ Período anterior
            </button>
          </div>
          <PeriodComparison rangeA={rangeA} rangeB={rangeB} />
        </>
      )}

      {tab === 'campanhas' && data && (
        <>
          <section className={styles.section}>
            <h2 className={styles.h2}>Funil de conversão</h2>
            <FunnelBar funil={data.funil} />
          </section>
          <section className={styles.chartsGrid}>
            <ChartTile title="ROAS por plataforma"><RoasChart data={data.chartRoas} /></ChartTile>
            <ChartTile title="Mensagens · Agendamentos · Vendas"><ConvChart data={data.chartConv} /></ChartTile>
            <ChartTile title="CTR por hora"><CtrChart data={data.chartCtr} /></ChartTile>
            <ChartTile title="Distribuição do orçamento"><BudgetChart data={data.budget} /></ChartTile>
          </section>
          <section className={styles.section}>
            <h2 className={styles.h2}>Campanhas ativas</h2>
            <CampaignTable campanhas={data.campanhas} />
          </section>
        </>
      )}

      {explain && <MetricExplainer metric={explain} onClose={() => setExplainKey(null)} />}
      {showBriefing && (
        <BriefingModal
          onClose={() => setShowBriefing(false)}
          summary={summary}
          prev={prevSummary}
          ig={ig}
          wa={wa}
          days={dailyDays}
        />
      )}
    </div>
  )
}

function renderDelta(curr, prev, suffix = '') {
  if (prev == null || prev === 0) return null
  const pct = deltaPct(curr, prev)
  return `${fmtDelta(pct, suffix || '%')} vs ant.`
}

function deltaClass(pct) {
  if (pct >= 100) return styles.deltaUp
  if (pct >= 75) return styles.deltaOk
  return styles.deltaWarn
}

function SourcePill({ usingMock }) {
  return (
    <span className={`${styles.sourcePill} ${usingMock ? styles.sourcePillMock : styles.sourcePillLive}`}>
      <span className={styles.sourceDot} />
      {usingMock ? 'simulado' : 'ao vivo'}
    </span>
  )
}

function ChartTile({ title, children }) {
  return (
    <div className={styles.chartTile}>
      <h3 className={styles.chartTitle}>{title}</h3>
      {children}
    </div>
  )
}

function AttentionList({ anomalies, hype, hypeCount }) {
  const items = []
  if (hype) {
    items.push({
      key: 'hype',
      dot: HYPE_LEVELS[hype.level].color,
      title: `${HYPE_LEVELS[hype.level].label}: "${hype.titulo || hype.caption?.slice(0, 60) || 'post'}"`,
      sub: `${hypeCount} post${hypeCount > 1 ? 's' : ''} acima da média do perfil`,
      tone: 'good',
    })
  }
  for (const a of anomalies) {
    items.push({
      key: a.key,
      dot: a.tone === 'good' ? 'var(--color-success)' : 'var(--accent-red)',
      title: a.mensagem,
      sub: `atual ${a.atual} · padrão ${a.esperado}`,
      tone: a.tone,
    })
  }

  if (items.length === 0) {
    return (
      <section className={styles.attentionSection}>
        <div className={styles.attentionHead}>
          <h2 className={styles.h2}>Atenção agora</h2>
          <span className={styles.attentionCount}>tudo em dia</span>
        </div>
        <p className={styles.calm}>Sem anomalias nos últimos {dailyDaysLabel()}. Operação dentro do padrão.</p>
      </section>
    )
  }

  return (
    <section className={styles.attentionSection}>
      <div className={styles.attentionHead}>
        <h2 className={styles.h2}>Atenção agora</h2>
        <span className={styles.attentionCount}>{items.length} item{items.length > 1 ? 's' : ''}</span>
      </div>
      <div className={styles.attentionList}>
        {items.map(it => (
          <div key={it.key} className={styles.attentionRow}>
            <span className={styles.attentionDot} style={{ background: it.dot }} />
            <div className={styles.attentionBody}>
              <p className={styles.attentionTitle}>{it.title}</p>
              <p className={styles.attentionSub}>{it.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function dailyDaysLabel() {
  return '7d'
}

function mapRangeToPeriod(range) {
  if (!range) return 'hoje'
  const days = Math.round((range.to - range.from) / (1000 * 60 * 60 * 24)) + 1
  if (days <= 1)  return 'hoje'
  if (days <= 10) return 'semana'
  return 'mes'
}
