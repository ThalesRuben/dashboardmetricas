import { useState, useMemo } from 'react'
import {
  useWhatsAppMetrics,
  useInbox,
  useWhatsAppInboxes,
  Inbox,
  DisparoMassa,
  formatarPhoneBR,
} from '@/features/whatsapp'
import type {
  WhatsAppThreadReal,
  WhatsAppThreadStatusReal,
  WhatsAppConversa,
  WhatsAppConversaStatus,
} from '@/features/whatsapp'
import { fmtNumber, fmtPct } from '@/shared/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import KpiCard from '@/shared/ui/KpiCard'
import SocialLineChart from '@/components/social/SocialLineChart'
import styles from './WhatsAppPage.module.css'

const STATUS: Record<WhatsAppThreadStatusReal, { label: string; tone: string; urgent: boolean }> = {
  lead:      { label: 'Lead',      tone: 'amber',   urgent: true  },
  aberta:    { label: 'Aberta',    tone: 'plain',   urgent: true  },
  agendado:  { label: 'Agendado',  tone: 'accent',  urgent: false },
  venda:     { label: 'Venda',     tone: 'success', urgent: false },
  arquivada: { label: 'Arquivada', tone: 'subtle',  urgent: false },
}

// Rótulos amigáveis dos números WhatsApp Business. Edite aqui pra renomear.
// Sem entrada no mapa → chip mostra o telefone formatado "(31) 9XXXX-XXXX".
const INBOX_LABELS: Record<string, string> = {
  '5531990842381': 'Inbox Fabio',
  '5531991340420': 'Inbox TBC',
}

export default function WhatsAppPage() {
  // null = "Todos os números" (agregado). String = filtra por aquele inbox_phone.
  const [inboxPhone, setInboxPhone] = useState<string | null>(null)
  const { data, loading, usingMock } = useWhatsAppMetrics(inboxPhone)
  const { threads } = useInbox({ inboxPhone })
  const { inboxes } = useWhatsAppInboxes()
  const [tab, setTab] = useState('inbox')

  const urgentes = useMemo(
    () => threads.filter(t => (t.nao_lidas || 0) > 0 || STATUS[t.status]?.urgent),
    [threads],
  )

  const naoLidasTotal = useMemo(
    () => threads.reduce((acc, t) => acc + (t.nao_lidas || 0), 0),
    [threads],
  )

  if (loading || !data) {
    return <div className={styles.page}><div className={styles.loading}>Carregando WhatsApp...</div></div>
  }

  const r = data.resumo
  // Só mostra o banner de "demo" se realmente não tem dado real chegando.
  const semDadoReal = usingMock && threads.length === 0

  const tabs = [
    { id: 'inbox',    label: 'Inbox', badge: naoLidasTotal || undefined },
    { id: 'precisam', label: 'Precisam de você', badge: urgentes.length || undefined },
    { id: 'todas',    label: 'Todas as conversas', badge: threads.length || undefined },
    { id: 'disparo',  label: 'Disparo em massa' },
    { id: 'funil',    label: 'Funil' },
    { id: 'origem',   label: 'Origem & motivos' },
  ]

  // DisparoMassa ainda fala o tipo legado WhatsAppConversa — adapta as threads.
  const conversasLegado = threads.map(threadToConversa)

  return (
    <div className={styles.page}>
      <PageHeader
        section="whatsapp"
        title="WhatsApp"
        subtitle={`${fmtNumber(r.conversas)} conversas no período · tempo médio de resposta ${r.tempo_resposta_min} min`}
        actions={
          <span className={styles.connected}>
            <span className={styles.dot} />
            Conectado
          </span>
        }
      />

      {semDadoReal && <Banner>Dados de demonstração. Aguardando primeira mensagem real.</Banner>}

      {inboxes.length > 1 && (
        <InboxFilter
          inboxes={inboxes}
          selected={inboxPhone}
          onSelect={setInboxPhone}
        />
      )}

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

      {tab === 'inbox' && <Inbox />}

      {tab === 'precisam' && (
        urgentes.length === 0 ? (
          <p className={styles.empty}>Fila vazia. Nada precisa de você agora.</p>
        ) : (
          <div className={styles.queue}>
            <p className={styles.queueHint}>
              {urgentes.length} conversa{urgentes.length > 1 ? 's' : ''} esperando você. Responda em até 10 min pra manter a meta de conversão.
            </p>
            {urgentes.map((t) => <ThreadRow key={t.id} t={t} onOpen={() => setTab('inbox')} />)}
          </div>
        )
      )}

      {tab === 'todas' && (
        threads.length === 0 ? (
          <p className={styles.empty}>Nenhuma conversa ainda. Assim que chegar mensagem, ela aparece aqui.</p>
        ) : (
          <div className={styles.queue}>
            {threads.map((t) => <ThreadRow key={t.id} t={t} onOpen={() => setTab('inbox')} />)}
          </div>
        )
      )}

      {tab === 'disparo' && (
        <DisparoMassa conversas={conversasLegado} />
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

function InboxFilter({
  inboxes,
  selected,
  onSelect,
}: {
  inboxes: { inbox_phone: string; threads: number }[]
  selected: string | null
  onSelect: (v: string | null) => void
}) {
  const total = inboxes.reduce((acc, i) => acc + i.threads, 0)
  return (
    <div className={styles.inboxFilter} role="tablist" aria-label="Filtrar por número WhatsApp">
      <button
        type="button"
        role="tab"
        aria-selected={selected === null}
        className={`${styles.inboxChip} ${selected === null ? styles.inboxChipActive : ''}`}
        onClick={() => onSelect(null)}
      >
        Todos
        <span className={styles.inboxChipCount}>{total}</span>
      </button>
      {inboxes.map((i) => {
        const label = INBOX_LABELS[i.inbox_phone] || formatarPhoneBR(i.inbox_phone)
        return (
          <button
            type="button"
            role="tab"
            key={i.inbox_phone}
            aria-selected={selected === i.inbox_phone}
            className={`${styles.inboxChip} ${selected === i.inbox_phone ? styles.inboxChipActive : ''}`}
            onClick={() => onSelect(i.inbox_phone)}
            title={formatarPhoneBR(i.inbox_phone)}
          >
            {label}
            <span className={styles.inboxChipCount}>{i.threads}</span>
          </button>
        )
      })}
    </div>
  )
}

function ThreadRow({ t, onOpen }: { t: WhatsAppThreadReal; onOpen: () => void }) {
  const s = STATUS[t.status] || STATUS.aberta
  const nome = t.contato_nome || t.contato_phone || '—'
  const preview = t.ultima_msg_preview || 'Sem mensagens ainda.'
  return (
    <div className={styles.convRow} onClick={onOpen} role="button" tabIndex={0}>
      <span className={styles.convAvatar}>{nome.slice(0, 1).toUpperCase()}</span>
      <div className={styles.convBody}>
        <div className={styles.convTop}>
          <span className={styles.convNome}>{nome}</span>
          <span className={`${styles.convTag} ${styles['t_' + s.tone]}`}>{s.label}</span>
        </div>
        <p className={styles.convResumo}>{preview}</p>
        <span className={styles.convMeta}>
          {fmtHoraCurta(t.ultima_atividade)} · via {t.origem}
          {(t.nao_lidas || 0) > 0 && ` · ${t.nao_lidas} não lida${t.nao_lidas > 1 ? 's' : ''}`}
        </span>
      </div>
    </div>
  )
}

function fmtHoraCurta(iso: string): string {
  try {
    const d = new Date(iso)
    const hoje = new Date()
    if (d.toDateString() === hoje.toDateString()) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch { return iso }
}

function threadToConversa(t: WhatsAppThreadReal): WhatsAppConversa {
  const statusLegado: WhatsAppConversaStatus =
    t.status === 'arquivada' ? 'aberta' : (t.status as WhatsAppConversaStatus)
  return {
    id: t.id,
    nome: t.contato_nome || t.contato_phone || '—',
    resumo: t.ultima_msg_preview || '',
    status: statusLegado,
    hora: fmtHoraCurta(t.ultima_atividade),
    origem: t.origem,
    telefone: t.contato_phone,
    nao_lidas: t.nao_lidas,
  }
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
