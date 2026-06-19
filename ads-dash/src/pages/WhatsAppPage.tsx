import { useState, useMemo } from 'react'
import { useWhatsAppMetrics, Inbox, DisparoMassa } from '@/features/whatsapp'
import { fmtNumber, fmtPct } from '@/shared/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import KpiCard from '@/shared/ui/KpiCard'
import SocialLineChart from '@/components/social/SocialLineChart'
import styles from './WhatsAppPage.module.css'

const STATUS = {
  lead:     { label: 'Lead', tone: 'amber',   urgent: true  },
  aberta:   { label: 'Aberta', tone: 'plain', urgent: true  },
  agendado: { label: 'Agendado', tone: 'accent', urgent: false },
  venda:    { label: 'Venda', tone: 'success', urgent: false },
}

export default function WhatsAppPage() {
  const { data, loading, usingMock } = useWhatsAppMetrics()
  const [tab, setTab] = useState('inbox')

  const urgentes = useMemo(
    () => (data?.conversas_recentes || []).filter(c => STATUS[c.status]?.urgent),
    [data?.conversas_recentes]
  )

  if (loading || !data) {
    return <div className={styles.page}><div className={styles.loading}>Carregando WhatsApp...</div></div>
  }

  const r = data.resumo

  const naoLidasTotal = (data.conversas_recentes || []).reduce(
    (acc, c) => acc + (c.nao_lidas || 0),
    0,
  )

  const tabs = [
    { id: 'inbox',    label: 'Inbox', badge: naoLidasTotal || undefined },
    { id: 'precisam', label: 'Precisam de você', badge: urgentes.length || undefined },
    { id: 'todas',    label: 'Todas as conversas' },
    { id: 'disparo',  label: 'Disparo em massa' },
    { id: 'funil',    label: 'Funil' },
    { id: 'origem',   label: 'Origem & motivos' },
  ]

  return (
    <div className={styles.page}>
      <PageHeader
        section="whatsapp"
        title="WhatsApp"
        subtitle={`${fmtNumber(r.conversas)} conversas no período · ticket médio R$ ${fmtNumber(r.ticket_medio)}`}
        actions={
          <span className={styles.connected}>
            <span className={styles.dot} />
            Conectado
          </span>
        }
      />

      {usingMock && <Banner>Dados de demonstração. Plugue a WhatsApp Cloud API em <strong>Integrações</strong>.</Banner>}

      <section className={styles.kpis}>
        <KpiCard
          label="Conversas"
          value={fmtNumber(r.conversas)}
          delta={`${r.conversas_delta >= 0 ? '+' : ''}${r.conversas_delta}% vs ant.`}
          up={r.conversas_delta > 0}
          accentColor="var(--section-whatsapp)"
        />
        <KpiCard
          label="Agendamentos"
          value={fmtNumber(r.agendamentos)}
          delta={`${r.agendamentos_delta >= 0 ? '+' : ''}${r.agendamentos_delta}% vs ant.`}
          up={r.agendamentos_delta > 0}
        />
        <KpiCard
          label="Conversão"
          value={fmtPct(r.taxa_conversao)}
          delta={null}
          neutral
        />
        <KpiCard
          label="Tempo de resposta"
          value={`${r.tempo_resposta_min} min`}
          delta={r.tempo_resposta_min <= 10 ? 'dentro da meta (10min)' : 'acima da meta'}
          up={r.tempo_resposta_min <= 10}
        />
      </section>

      <Tabs items={tabs} activeId={tab} onChange={setTab} accentColor="var(--section-whatsapp)" />

      {tab === 'inbox' && (
        <Inbox conversas={data.conversas_recentes || []} />
      )}

      {tab === 'precisam' && (
        urgentes.length === 0 ? (
          <p className={styles.empty}>Fila vazia. Nada precisa de você agora.</p>
        ) : (
          <div className={styles.queue}>
            <p className={styles.queueHint}>
              {urgentes.length} conversa{urgentes.length > 1 ? 's' : ''} esperando você. Responda em até 10 min pra manter a meta de conversão.
            </p>
            {urgentes.map((c, i) => <ConvRow key={i} c={c} />)}
          </div>
        )
      )}

      {tab === 'todas' && (
        <div className={styles.queue}>
          {(data.conversas_recentes || []).map((c, i) => <ConvRow key={i} c={c} />)}
        </div>
      )}

      {tab === 'disparo' && (
        <DisparoMassa conversas={data.conversas_recentes || []} />
      )}

      {tab === 'funil' && (
        <>
          <section className={styles.section}>
            <h2 className={styles.h2}>Funil de atendimento</h2>
            <Funnel funil={data.funil} />
          </section>
          <section className={styles.chartsGrid}>
            <ChartTile title="Conversas por dia">
              <SocialLineChart serie={data.serie_conversas} color="#5dcaa5" type="bar" />
            </ChartTile>
            <ChartTile title="Taxa de conversão (%)">
              <SocialLineChart serie={data.serie_conversao} color="#5dcaa5" />
            </ChartTile>
          </section>
        </>
      )}

      {tab === 'origem' && (
        <div className={styles.split}>
          <Card title="Origem das conversas">
            {(data.origens || []).map(o => (
              <BarRow key={o.origem} label={o.origem} value={fmtNumber(o.conversas)} pct={o.pct} />
            ))}
          </Card>
          <Card title="Motivos de contato">
            {(data.motivos || []).map(m => (
              <BarRow key={m.motivo} label={m.motivo} value={fmtPct(m.pct)} pct={m.pct} tone={m.tag === 'quente' ? 'magenta' : m.tag === 'morno' ? 'amber' : 'subtle'} />
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}

function Banner({ children }) {
  return <div className={styles.banner}>ⓘ {children}</div>
}

function ConvRow({ c }) {
  const s = STATUS[c.status] || STATUS.aberta
  return (
    <div className={styles.convRow}>
      <span className={styles.convAvatar}>{c.nome.slice(0,1)}</span>
      <div className={styles.convBody}>
        <div className={styles.convTop}>
          <span className={styles.convNome}>{c.nome}</span>
          <span className={`${styles.convTag} ${styles['t_' + s.tone]}`}>{s.label}</span>
        </div>
        <p className={styles.convResumo}>{c.resumo}</p>
        <span className={styles.convMeta}>{c.hora} · via {c.origem}</span>
      </div>
    </div>
  )
}

function Funnel({ funil }) {
  const top = funil?.[0]?.valor || 1
  return (
    <div className={styles.funnel}>
      {funil.map((f, i) => {
        const pct = Math.round((f.valor / top) * 100)
        return (
          <div key={f.etapa} className={styles.funnelRow}>
            <div className={styles.funnelHead}>
              <span className={styles.funnelEtapa}>{f.etapa}</span>
              <span className={styles.funnelValor}>{fmtNumber(f.valor)} · {pct}%</span>
            </div>
            <div className={styles.funnelTrack}>
              <span className={styles.funnelFill} style={{ width: `${pct}%`, opacity: 1 - i * 0.12 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BarRow({ label, value, pct, tone = 'accent' }) {
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <span className={styles.barTrack}>
        <span className={`${styles.barFill} ${styles['b_' + tone]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      <span className={styles.barValue}>{value}</span>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {children}
    </div>
  )
}

function ChartTile({ title, children }) {
  return (
    <div className={styles.chartTile}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {children}
    </div>
  )
}
