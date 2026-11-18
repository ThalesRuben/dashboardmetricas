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
  const { data, loading, erro, usingMock, refresh } = useWhatsAppMetrics(inboxPhone, range)

  if (erro && !data) {
    return (
      <article className={styles.card}>
        <header className={styles.head}>
          <h3 className={styles.title}>{label}</h3>
          <span className={styles.phone}>{formatarPhoneBR(inboxPhone)}</span>
        </header>
        <p className={styles.loading} role="alert">Não foi possível carregar os dados desta linha.</p>
        <button type="button" className="cc-btn" onClick={() => void refresh()}>Tentar novamente</button>
      </article>
    )
  }

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
  const respondidas = r.respondidas ?? data.funil.find(f => f.etapa === 'Respondidas')?.valor ?? 0
  const pendentes = r.sem_resposta ?? Math.max(0, r.conversas - respondidas)
  const status = r.conversas === 0 ? 'Sem mensagens'
    : pendentes > 0 ? `${fmtNumber(pendentes)} sem resposta` : 'Todas respondidas'
  const entradaMin = Number.isFinite(r.tempo_resposta_min) ? r.tempo_resposta_min : null
  const turnoMin = Number.isFinite(r.tempo_resposta_turno_min) ? r.tempo_resposta_turno_min : null
  const turnoOk = turnoMin !== null && turnoMin >= 0 && turnoMin <= 15

  // Funil complementar aos KPIs — mostra as etapas que NÃO repetem os KPIs
  // de cima (Leads, Respostas e Vendas). Conversas/Agendamentos/Conversão
  // já estão na linha de KPIs.
  const etapas = [
    { label: 'Interesse detectado', valor: r.leads, texto: fmtNumber(r.leads) },
    { label: 'Respondidas', valor: respondidas, texto: `${fmtNumber(respondidas)} · ${fmtPct(r.taxa_resposta)}` },
    { label: 'Vendas registradas', valor: r.vendas_registradas ?? 0, texto: fmtNumber(r.vendas_registradas ?? 0) },
  ]
  const topo = Math.max(1, r.conversas || 1)

  return (
    <article
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(inboxPhone)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(inboxPhone) } }}
    >
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <h3 className={styles.title}>{label}</h3>
          <span className={styles.phone}>{formatarPhoneBR(inboxPhone)} · {fmtNumber(threads)} registros no histórico</span>
        </div>
        <span className={`${styles.statusTag} ${r.conversas === 0 ? styles.statusEmpty : pendentes === 0 ? styles.statusOk : styles.statusWarn}`}>
          {status}
        </span>
      </header>

      <div className={styles.kpis}>
        <Kpi label="Conversas recebidas" value={fmtNumber(r.conversas)} />
        <Kpi label="Agend. detectados" value={fmtNumber(r.agendamentos)} sub="estimativa pelas mensagens" />
        <Kpi label="Conv. estimada" value={fmtPct(r.taxa_conversao)} />
        <Kpi
          label="T. 1ª resposta"
          value={entradaMin !== null ? `${entradaMin}m` : '—'}
          sub={`${fmtPct(r.pct_sla_resposta)} ≤10m`}
          tone={entradaMin === null ? undefined : entradaMin <= 10 ? 'ok' : 'warn'}
        />
        <Kpi
          label="T. por turno"
          value={turnoMin !== null ? `${turnoMin}m` : '—'}
          sub="mediana · tempo corrido"
          tone={turnoMin === null ? undefined : turnoOk ? 'ok' : 'warn'}
        />
      </div>

      <p className={styles.sourceNote}>
        {usingMock ? 'Dados de demonstração.' : 'Contatos únicos que enviaram mensagens no período, por linha.'}
      </p>
      {erro && <p className={styles.sourceNote} role="alert">Falha ao atualizar. Exibindo os dados da última consulta.</p>}

      <div className={styles.funil}>
        {etapas.map((e, i) => {
          const pct = Math.max(0, Math.min(100, (e.valor / topo) * 100))
          return (
            <div key={e.label} className={styles.funilRow}>
              <span className={styles.funilLabel}>{e.label}</span>
              <span className={styles.funilTrack}>
                <span className={styles.funilFill} style={{ width: `${pct}%`, opacity: 1 - i * 0.15 }} />
              </span>
              <span className={styles.funilVal}>{e.texto}</span>
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
