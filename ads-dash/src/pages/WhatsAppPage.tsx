import { useState, useMemo, useEffect } from 'react'
import {
  useWhatsAppMetrics,
  useInbox,
  useWhatsAppInboxes,
  useCrmSummary,
  useFollowupsPendentes,
  useSetThreadStatus,
  useCoachRascunhos,
  Inbox,
  DisparoMassa,
  InboxReportCard,
  CommercialReportPanel,
  CrmKanban,
  CrmThreadDrawer,
  FollowupsFila,
  ReativacaoSugestoes,
  formatarPhoneBR,
  prettyPreview,
  displayName,
  crmRepo,
} from '@/features/whatsapp'
import type {
  WhatsAppThreadReal,
  WhatsAppThreadStatusReal,
  WhatsAppConversa,
  WhatsAppConversaStatus,
  CrmCardExtras,
} from '@/features/whatsapp'
import { fmtNumber, fmtPct, fmtBRL } from '@/shared/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import KpiCard from '@/shared/ui/KpiCard'
import SocialLineChart from '@/components/social/SocialLineChart'
import DateRangePicker from '@/shared/ui/DateRangePicker'
import styles from './WhatsAppPage.module.css'

const WHATSAPP_PRESETS = [
  { key: 'hoje',   label: 'Hoje',          days: 1 },
  { key: 'ontem',  label: 'Ontem',         days: 1, offset: 1 },
  { key: '7',      label: 'Últimos 7d',    days: 7 },
  { key: '15',     label: 'Últimos 15d',   days: 15 },
  { key: '30',     label: 'Últimos 30d',   days: 30 },
  { key: 'custom', label: 'Personalizado', days: null },
]

function defaultRange() {
  const to = new Date(); to.setHours(23, 59, 59, 999)
  const from = new Date(to); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0)
  return { from, to, presetKey: '30' }
}

// Rótulos amigáveis dos números WhatsApp Business. Edite aqui pra renomear.
// Sem entrada no mapa → chip mostra o telefone formatado "(31) 9XXXX-XXXX".
const INBOX_LABELS: Record<string, string> = {
  '5531990842381': 'Inbox TBC',
  '5531991340420': 'Inbox Fabio',
}

export default function WhatsAppPage() {
  // null = "Todos os números" (agregado). String = filtra por aquele inbox_phone.
  const [inboxPhone, setInboxPhone] = useState<string | null>(null)
  const [range, setRange] = useState<{ from: Date; to: Date; presetKey?: string } | null>(defaultRange)
  // Vida ativa (default) vs histórico completo. "Ativas 30d" esconde
  // arquivadas e threads sem msg nos últimos 30 dias — bate com o
  // arquivamento manual de 2026-10-22. "Mostrar todas" libera tudo pra
  // consulta pontual sem perder o default limpo pros atendentes.
  const [showInactive, setShowInactive] = useState(false)
  const { data, loading, usingMock } = useWhatsAppMetrics(inboxPhone, range)
  const { inboxes } = useWhatsAppInboxes()
  const selfInboxPhones = useMemo(() => inboxes.map((i) => i.inbox_phone), [inboxes])
  const { threads, reloadThreads } = useInbox({ inboxPhone, selfInboxPhones, showInactive })
  const [tab, setTab] = useState('inbox')

  // Estado do drawer CRM (usado pela aba "CRM" e "Follow-ups")
  const [drawerThreadId, setDrawerThreadId] = useState<string | null>(null)
  const drawerThread = threads.find(t => t.id === drawerThreadId) || null

  const rangeParaSummary = useMemo(
    () => range ? { from: range.from, to: range.to } : null,
    [range],
  )
  const { summary: crmSummary, refresh: refreshSummary } = useCrmSummary(rangeParaSummary)
  const { followups: followupsPend, marcarFeito: marcarFollowupFeito, refresh: refreshFollowups } = useFollowupsPendentes()
  const { rascunhos: coachRascunhos } = useCoachRascunhos()
  const setThreadStatus = useSetThreadStatus()

  // Extras (tags, próximo followup, última venda) por thread — carrega quando abre CRM.
  const [extrasPorThread, setExtrasPorThread] = useState<Record<string, CrmCardExtras>>({})
  useEffect(() => {
    if (tab !== 'crm' || threads.length === 0) return
    let cancelled = false
    ;(async () => {
      // Carrega em paralelo mas limita pra não estourar (top 40 mais recentes).
      const alvos = threads.slice(0, 40)
      const resultados = await Promise.all(alvos.map(async (t) => {
        const [tags, fups, vendas] = await Promise.all([
          crmRepo.tagsDaThread(t.id).catch(() => []),
          crmRepo.followupsDaThread(t.id).catch(() => []),
          crmRepo.listarVendas(t.id).catch(() => []),
        ])
        const proxFollowup = fups.find(f => !f.feito) ?? null
        const ultimaVenda = vendas[0] ?? null
        return [t.id, { tags, proxFollowup, ultimaVenda }] as const
      }))
      if (cancelled) return
      const map: Record<string, CrmCardExtras> = {}
      for (const [id, extras] of resultados) map[id] = extras
      setExtrasPorThread(map)
    })()
    return () => { cancelled = true }
  }, [tab, threads])

  async function handleMoverStatus(threadId: string, novo: WhatsAppThreadStatusReal) {
    // Update otimista via reload — sem estado local pra evitar drift com realtime.
    await setThreadStatus(threadId, novo)
    await reloadThreads()
    refreshSummary()
  }

  async function handleChangeStatusDrawer(novo: WhatsAppThreadStatusReal) {
    if (!drawerThread) return
    await handleMoverStatus(drawerThread.id, novo)
  }

  // "Precisam de você" = última msg do cliente ainda sem resposta OU com
  // não lidas pendentes. Status 'aberta' sozinho NÃO qualifica — ex-leads
  // confirmados ficam aberta mas já foram respondidos.
  const urgentes = useMemo(
    () => threads.filter((t) => {
      const naoLidas = t.nao_lidas || 0
      if (naoLidas > 0) return true
      // Thread 'lead' sempre entra na fila (recém-criada, cliente aguarda).
      if (t.status === 'lead') return true
      // 'aberta' só entra se tiver não lidas (já capturado acima).
      return false
    }),
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

  const followupsAtrasados = followupsPend.filter(f => new Date(f.data) < new Date()).length
  const followupsBadge = followupsPend.length
    ? (followupsAtrasados > 0 ? `${followupsPend.length} · ${followupsAtrasados} atrasado` : followupsPend.length)
    : undefined

  const tabs = [
    { id: 'inbox',       label: 'Inbox', badge: naoLidasTotal || urgentes.length || undefined },
    { id: 'crm',         label: 'CRM', badge: threads.length || undefined },
    { id: 'reativacoes', label: 'Reativações IA', badge: coachRascunhos.length || undefined },
    { id: 'followups',   label: 'Follow-ups', badge: followupsBadge },
    { id: 'disparo',     label: 'Disparo em massa' },
    { id: 'analytics',   label: 'Analytics' },
    { id: 'relatorio',   label: 'Relatório IA' },
  ]

  // DisparoMassa ainda fala o tipo legado WhatsAppConversa — adapta as threads.
  const conversasLegado = threads.map(threadToConversa)

  return (
    <div className={styles.page}>
      <PageHeader
        section="whatsapp"
        title="WhatsApp"
        subtitle={`${fmtNumber(r.conversas)} conversas no período · tempo mediano de resposta ${r.tempo_resposta_min} min`}
        actions={
          <div className={styles.headerActions}>
            <DateRangePicker value={range} onChange={setRange} presets={WHATSAPP_PRESETS} />
            <ActiveToggle value={showInactive} onChange={setShowInactive} />
            <span className={styles.connected}>
              <span className={styles.dot} />
              Conectado
            </span>
          </div>
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

      {/* No modo "Todos" com 2+ inboxes, mostra relatório por número lado-a-lado
          em vez de KPIs agregados misturando tudo. */}
      {inboxPhone === null && inboxes.length > 1 ? (
        <section className={styles.reportGrid} aria-label="Relatório por número WhatsApp">
          {inboxes.map((i) => (
            <InboxReportCard
              key={i.inbox_phone}
              inboxPhone={i.inbox_phone}
              label={INBOX_LABELS[i.inbox_phone] || formatarPhoneBR(i.inbox_phone)}
              threads={i.threads}
              onOpen={setInboxPhone}
              range={range}
            />
          ))}
        </section>
      ) : (
        <section className={styles.kpis}>
          <KpiCard
            label="Receita"
            value={fmtBRL(r.receita_total ?? 0)}
            delta={(r.vendas_registradas ?? 0) > 0
              ? `${fmtNumber(r.vendas_registradas ?? 0)} venda${(r.vendas_registradas ?? 0) > 1 ? 's' : ''} · ${fmtDelta(r.receita_delta ?? 0)}`
              : 'registre vendas no CRM'}
            up={(r.receita_delta ?? 0) > 0}
            accentColor="var(--section-whatsapp)"
          />
          <KpiCard
            label="Conversas"
            value={fmtNumber(r.conversas)}
            delta={fmtDelta(r.conversas_delta)}
            up={r.conversas_delta > 0}
          />
          <KpiCard
            label="Agendamentos"
            value={fmtNumber(r.agendamentos)}
            delta={fmtDelta(r.agendamentos_delta)}
            up={r.agendamentos_delta > 0}
          />
          <KpiCard
            label="Conversão"
            value={fmtPct(r.taxa_conversao)}
            delta="agendamentos / conversas"
            neutral
          />
          <KpiCard
            label="T. até 1ª resposta"
            value={`${r.tempo_resposta_min} min`}
            delta={`${fmtPct(r.pct_sla_resposta)} em ≤10min`}
            up={r.pct_sla_resposta >= 60}
          />
          <KpiCard
            label="T. médio por turno"
            value={`${r.tempo_resposta_turno_min} min`}
            delta="entre msgs do cliente e resposta"
            up={r.tempo_resposta_turno_min > 0 && r.tempo_resposta_turno_min <= 15}
          />
        </section>
      )}

      <Tabs items={tabs} activeId={tab} onChange={setTab} accentColor="var(--section-whatsapp)" />

      {tab === 'inbox' && <Inbox showInactive={showInactive} />}

      {tab === 'crm' && (
        <CrmKanban
          threads={threads}
          summary={crmSummary}
          extrasPorThread={extrasPorThread}
          onOpen={(t) => setDrawerThreadId(t.id)}
          onMover={handleMoverStatus}
        />
      )}

      {tab === 'reativacoes' && <ReativacaoSugestoes />}

      {tab === 'followups' && (
        <FollowupsFila
          followups={followupsPend}
          onAbrir={(id) => setDrawerThreadId(id)}
          onMarcarFeito={async (id) => {
            await marcarFollowupFeito(id)
            refreshSummary()
          }}
        />
      )}

      {tab === 'disparo' && (
        <DisparoMassa conversas={conversasLegado} />
      )}

      {tab === 'analytics' && (
        <>
          <section className={styles.section}>
            <h2 className={styles.h2}>Funil de atendimento</h2>
            <Funnel funil={data.funil} />
          </section>
          <section className={styles.chartsGrid}>
            <ChartTile
              title="Conversas por dia"
              ariaLabel={`Gráfico de barras: conversas iniciadas por dia nos últimos ${data.serie_conversas.length} dias.`}
            >
              <SocialLineChart serie={data.serie_conversas} color="#5dcaa5" type="bar" />
            </ChartTile>
            <ChartTile
              title="Taxa de conversão (%)"
              ariaLabel={`Gráfico de linha: taxa de conversão semanal. Último valor ${data.serie_conversao[data.serie_conversao.length - 1]?.value ?? 0}%.`}
            >
              <SocialLineChart serie={data.serie_conversao} color="#5dcaa5" />
            </ChartTile>
          </section>
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
        </>
      )}

      {tab === 'relatorio' && (
        <CommercialReportPanel
          inboxPhone={inboxPhone}
          inboxLabel={inboxPhone ? (INBOX_LABELS[inboxPhone] || formatarPhoneBR(inboxPhone)) : 'Todos os números'}
        />
      )}

      {drawerThread && (
        <CrmThreadDrawer
          thread={drawerThread}
          onClose={() => setDrawerThreadId(null)}
          onChangeStatus={async (novo) => {
            await handleChangeStatusDrawer(novo)
            // Após venda/agendado, o resumo de fila muda
            refreshFollowups()
          }}
        />
      )}
    </div>
  )
}

function Banner({ children }) {
  return <div className={styles.banner}>ⓘ {children}</div>
}

function ActiveToggle({
  value, onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  // value=false → mostra só ativas 30d (default). value=true → todas.
  return (
    <div className={styles.activeToggle} role="tablist" aria-label="Filtrar por atividade recente">
      <button
        type="button"
        role="tab"
        aria-selected={!value}
        className={`${styles.activeChip} ${!value ? styles.activeChipOn : ''}`}
        onClick={() => onChange(false)}
      >
        Ativas 30d
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value}
        className={`${styles.activeChip} ${value ? styles.activeChipOn : ''}`}
        onClick={() => onChange(true)}
        title="Inclui arquivadas e threads sem atividade recente"
      >
        Mostrar todas
      </button>
    </div>
  )
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

// Delta % legível. RPC já cap em ±999, mas acima de 500 é ruído pra UX —
// mostra ">500%" / "<-500%" pra não poluir o card.
function fmtDelta(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) return 'estável vs ant.'
  if (delta >= 500)  return '+500%+ vs ant.'
  if (delta <= -500) return '-500%+ vs ant.'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}% vs ant.`
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
    nome: displayName(t.contato_nome, t.contato_phone),
    resumo: prettyPreview(t.ultima_msg_preview),
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
        // #49: 1 casa decimal. Topo é sempre 100,0% (base da pirâmide).
        // Também mostra % em relação à etapa anterior pra ver drop por salto.
        const pctTopo = top > 0 ? (f.valor / top) * 100 : 0
        const prev = i > 0 ? funil[i - 1].valor : f.valor
        const pctPrev = prev > 0 ? (f.valor / prev) * 100 : 0
        return (
          <div key={f.etapa} className={styles.funnelRow}>
            <div className={styles.funnelHead}>
              <span className={styles.funnelEtapa}>{f.etapa}</span>
              <span className={styles.funnelValor}>
                {fmtNumber(f.valor)} · {pctTopo.toFixed(1)}%
                {i > 0 && pctPrev < 100 && ` (${pctPrev.toFixed(1)}% da etapa anterior)`}
              </span>
            </div>
            <div className={styles.funnelTrack}>
              <span className={styles.funnelFill} style={{ width: `${pctTopo}%`, opacity: 1 - i * 0.12 }} />
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

function ChartTile({ title, children, ariaLabel }: { title: string; children: React.ReactNode; ariaLabel?: string }) {
  return (
    <div className={styles.chartTile} role="figure" aria-label={ariaLabel || title}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {children}
    </div>
  )
}
