import { useWhatsAppMetrics, type DateRange } from '../hooks/useWhatsAppMetrics'
import { formatarPhoneBR } from '../lib/phone'
import { fmtNumber, fmtPct } from '@/shared/lib/format'
import styles from './InboxReportCard.module.css'

export interface InboxReportCardProps {
  inboxPhone: string
  label: string
  threads: number
  onOpen: (phone: string) => void
  range?: DateRange | null
}

export default function InboxReportCard({ inboxPhone, label, threads, onOpen, range }: InboxReportCardProps) {
  const { data, loading } = useWhatsAppMetrics(inboxPhone, range)

  if (loading || !data) {
    return (
      <article className={styles.card} aria-busy="true">
        <header className={styles.head}>
          <h3 className={styles.title}>{label}</h3>
          <span className={styles.phone}>{formatarPhoneBR(inboxPhone)}</span>
        </header>
        <p className={styles.loading}>Carregando…</p>
      </article>
    )
  }

  const r = data.resumo
  const dentroMeta = r.tempo_resposta_min <= 10

  // Mini-funil: 4 etapas com altura proporcional ao topo (conversas)
  const etapas = [
    { label: 'Conversas',    valor: r.conversas },
    { label: 'Leads',        valor: r.leads },
    { label: 'Agendamentos', valor: r.agendamentos },
    { label: 'Conversão %',  valor: 0, custom: `${fmtPct(r.taxa_conversao)}` },
  ]
  const topo = Math.max(1, etapas[0].valor)

  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(inboxPhone)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpen(inboxPhone) }}
    >
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <h3 className={styles.title}>{label}</h3>
          <span className={styles.phone}>{formatarPhoneBR(inboxPhone)} · {threads} thread{threads === 1 ? '' : 's'}</span>
        </div>
        <span className={`${styles.statusTag} ${dentroMeta ? styles.statusOk : styles.statusWarn}`}>
          {dentroMeta ? 'no ritmo' : 'lento'}
        </span>
      </header>

      <div className={styles.kpis}>
        <Kpi label="Conversas"     value={fmtNumber(r.conversas)} />
        <Kpi label="Agendamentos"  value={fmtNumber(r.agendamentos)} />
        <Kpi label="Conversão"     value={fmtPct(r.taxa_conversao)} />
        <Kpi
          label="T. resposta"
          value={`${r.tempo_resposta_min}m`}
          sub={`${fmtPct(r.pct_sla_resposta)} ≤10m`}
          tone={dentroMeta ? 'ok' : 'warn'}
        />
      </div>

      <div className={styles.funil}>
        {etapas.map((e, i) => {
          const pct = e.custom ? 100 : Math.round((e.valor / topo) * 100)
          return (
            <div key={e.label} className={styles.funilRow}>
              <span className={styles.funilLabel}>{e.label}</span>
              <span className={styles.funilTrack}>
                <span className={styles.funilFill} style={{ width: `${Math.max(8, pct)}%`, opacity: 1 - i * 0.15 }} />
              </span>
              <span className={styles.funilVal}>{e.custom || fmtNumber(e.valor)}</span>
            </div>
          )
        })}
      </div>

      <footer className={styles.foot}>
        <span className={styles.openCta}>Ver relatório completo →</span>
      </footer>
    </article>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={`${styles.kpiValue} ${tone === 'warn' ? styles.kpiWarn : ''} ${tone === 'ok' ? styles.kpiOk : ''}`}>{value}</span>
      {sub && <span className={styles.kpiSub}>{sub}</span>}
    </div>
  )
}
