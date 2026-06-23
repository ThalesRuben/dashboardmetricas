import { useState, useMemo } from 'react'
import { useAuth } from '@/app/providers/AuthContext'
import { useMetrics } from '@/features/ads/hooks/useMetrics'
import { useInstagramMetrics } from '@/features/organic/instagram/hooks/useInstagramMetrics'
import { useWhatsAppMetrics } from '@/features/whatsapp'
import { MetasBanner } from '@/features/metas'
import { useDailyMetrics, previousRange, deltaPct } from '@/features/ads/hooks/useDailyMetrics'
import { detectHype, HYPE_LEVELS } from '@/features/organic/instagram/lib/hypeDetector'
import { detectAnomalies } from '@/lib/anomalies'
import { fmtNumber, fmtRoas, fmtDelta } from '@/shared/lib/format'
import { buildMetricExplain } from '@/shared/lib/metricDefinitions'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import HeroBlock from '@/components/ui/HeroBlock'
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
import BibleBadge from '@/components/ui/BibleBadge'
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

  const { summary, days: dailyDays } = useDailyMetrics(range)
  const prev = useMemo(() => previousRange(range), [range?.from?.getTime?.(), range?.to?.getTime?.()])
  const { summary: prevSummary } = useDailyMetrics(prev)
  const period = useMemo(() => mapRangeToPeriod(range), [range?.from?.getTime?.(), range?.to?.getTime?.()])
  const { data } = useMetrics(period)
  const { data: ig } = useInstagramMetrics()
  const { data: wa } = useWhatsAppMetrics()
  const { topHype, hypePosts } = detectHype(ig?.posts, ig?.account)
  const anomalies = useMemo(() => detectAnomalies(dailyDays), [dailyDays])

  const firstName = (profile?.full_name || user?.email?.split('@')[0] || '').split(' ')[0]
  const attentionCount = anomalies.length + (topHype ? 1 : 0)

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
      <PageHeader
        section="dashboard"
        title={greeting(firstName)}
        actions={
          <>
            <button className="btn" onClick={() => setShowBriefing(true)}>Briefing 1 página</button>
            <DateRangePicker value={range} onChange={setRange} />
          </>
        }
      />

      <MetasBanner />

      <Tabs items={tabsWithBadges} activeId={tab} onChange={setTab} accentColor="var(--section-dashboard)" />

      {tab === 'atencao' && summary && (
        <>
          <div className={styles.bibleStrip}>
            <BibleBadge to="/bible#conceito">
              Estas métricas validam o conceito <strong>luxo + experiência</strong> da marca
            </BibleBadge>
          </div>
          <HeroBlock
            left={<WeeklyBriefing summary={summary} prev={prevSummary} ig={ig} />}
            right={<HealthScore summary={summary} prev={prevSummary} ig={ig} whatsapp={wa} />}
          />

          <section className={styles.kpis}>
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
              label="Mensagens (WhatsApp)"
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
      <section className={styles.section}>
        <h2 className={styles.h2}>Atenção agora</h2>
        <p className={styles.calm}>Sem nada urgente. Operação dentro do padrão.</p>
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>Atenção agora</h2>
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

function mapRangeToPeriod(range) {
  if (!range) return 'hoje'
  const days = Math.round((range.to - range.from) / (1000 * 60 * 60 * 24)) + 1
  if (days <= 1)  return 'hoje'
  if (days <= 10) return 'semana'
  return 'mes'
}
