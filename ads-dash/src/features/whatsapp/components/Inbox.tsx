import { useState, useMemo, useEffect, useRef } from 'react'
import { useInbox } from '../hooks/useInbox'
import type {
  WhatsAppThreadReal,
  WhatsAppMsgReal,
  WhatsAppMsgStatus,
  WhatsAppThreadStatusReal,
} from '../api/types'
import InboxCoachPanel from './InboxCoachPanel'
import styles from './Inbox.module.css'

type Filter = 'todas' | 'nao_lidas' | 'leads' | 'agendados'

const STATUS_LABEL: Record<WhatsAppThreadStatusReal, string> = {
  lead:      'Lead',
  aberta:    'Aberta',
  agendado:  'Agendado',
  venda:     'Venda',
  arquivada: 'Arquivada',
}

const STATUS_TONE: Record<WhatsAppThreadStatusReal, string> = {
  lead:      'amber',
  aberta:    'plain',
  agendado:  'accent',
  venda:     'success',
  arquivada: 'subtle',
}

export default function Inbox() {
  const {
    threads,
    msgs,
    activeThread,
    setActiveId,
    enviando,
    erroEnvio,
    enviar,
    realtime,
  } = useInbox()
  const [filter, setFilter] = useState<Filter>('todas')

  const filtered = useMemo(() => {
    if (filter === 'nao_lidas') return threads.filter((t) => (t.nao_lidas || 0) > 0)
    if (filter === 'leads')     return threads.filter((t) => t.status === 'lead')
    if (filter === 'agendados') return threads.filter((t) => t.status === 'agendado')
    return threads
  }, [threads, filter])

  // Auto-seleciona primeira da lista filtrada
  useEffect(() => {
    if (filtered.length === 0) return
    if (!activeThread || !filtered.find((t) => t.id === activeThread.id)) {
      setActiveId(filtered[0].id)
    }
  }, [filtered, activeThread, setActiveId])

  const naoLidas = threads.reduce((acc, t) => acc + (t.nao_lidas || 0), 0)

  // Estado do composer fica aqui pra a IA poder injetar sugestões no input.
  const [texto, setTexto] = useState('')
  const composerRef = useRef<HTMLTextAreaElement | null>(null)

  return (
    <div className={styles.inbox}>
      <aside className={styles.listPane}>
        <div className={styles.listHead}>
          <span className={styles.listTitle}>Conversas</span>
          {naoLidas > 0 && <span className={styles.headBadge}>{naoLidas} não lidas</span>}
          {realtime && <span className={styles.headBadge} style={{ marginLeft: 6 }}>ao vivo</span>}
        </div>
        <div className={styles.filters}>
          {(['todas', 'nao_lidas', 'leads', 'agendados'] as Filter[]).map((f) => (
            <button
              key={f}
              className={`${styles.filterChip} ${filter === f ? styles.filterChipOn : ''}`}
              onClick={() => setFilter(f)}
              type="button"
            >
              {filterLabel(f)}
            </button>
          ))}
        </div>
        <ul className={styles.list}>
          {filtered.length === 0 && (
            <li className={styles.empty}>Nada por aqui.</li>
          )}
          {filtered.map((t) => (
            <li
              key={t.id}
              className={`${styles.listItem} ${t.id === activeThread?.id ? styles.listItemActive : ''}`}
              onClick={() => setActiveId(t.id)}
            >
              <span className={styles.avatar}>{(t.contato_nome || t.contato_phone).slice(0, 1)}</span>
              <div className={styles.listBody}>
                <div className={styles.listTop}>
                  <span className={styles.listName}>{t.contato_nome || t.contato_phone}</span>
                  <span className={styles.listTime}>{fmtHora(t.ultima_atividade)}</span>
                </div>
                <div className={styles.listBottom}>
                  <span className={styles.listPreview}>{t.ultima_msg_preview || '—'}</span>
                  {(t.nao_lidas || 0) > 0 && (
                    <span className={styles.unread}>{t.nao_lidas}</span>
                  )}
                </div>
                <div className={styles.listMeta}>
                  <span className={`${styles.tag} ${styles['t_' + STATUS_TONE[t.status]]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                  <span className={styles.metaOrigem}>via {t.origem}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <section className={styles.threadPane}>
        {activeThread ? (
          <Thread
            thread={activeThread}
            msgs={msgs}
            enviando={enviando}
            erroEnvio={erroEnvio}
            onSend={enviar}
            texto={texto}
            setTexto={setTexto}
            composerRef={composerRef}
          />
        ) : (
          <EmptyThread />
        )}
      </section>

      <aside className={styles.contactPane}>
        {activeThread ? (
          <>
            <ContactPanel thread={activeThread} totalMsgs={msgs.length} />
            <InboxCoachPanel
              thread={activeThread}
              msgs={msgs}
              onUseSuggestion={(t) => {
                setTexto(t)
                // foca o composer pra o usuário ajustar/enviar.
                requestAnimationFrame(() => composerRef.current?.focus())
              }}
            />
          </>
        ) : null}
      </aside>
    </div>
  )
}

function filterLabel(f: Filter) {
  if (f === 'todas')     return 'Todas'
  if (f === 'nao_lidas') return 'Não lidas'
  if (f === 'leads')     return 'Leads'
  return 'Agendados'
}

interface ThreadProps {
  thread: WhatsAppThreadReal
  msgs: WhatsAppMsgReal[]
  enviando: boolean
  erroEnvio: string | null
  onSend: (texto: string) => Promise<unknown>
  texto: string
  setTexto: (t: string) => void
  composerRef: React.MutableRefObject<HTMLTextAreaElement | null>
}

// Agrupa mensagens do mesmo autor em intervalo curto pra visualmente
// ficar mais próximo do WhatsApp (menos "cauda" e menos espaçamento).
const GROUP_WINDOW_MS = 2 * 60 * 1000

type ChatItem =
  | { kind: 'divider'; id: string; dateISO: string }
  | { kind: 'msg'; id: string; msg: WhatsAppMsgReal; grouped: boolean }

function buildChatItems(msgs: WhatsAppMsgReal[]): ChatItem[] {
  const items: ChatItem[] = []
  let prev: WhatsAppMsgReal | undefined
  for (const m of msgs) {
    const newDay = !prev || !mesmoDia(prev.hora, m.hora)
    if (newDay) items.push({ kind: 'divider', id: 'd-' + m.id, dateISO: m.hora })
    const grouped =
      !!prev &&
      !newDay &&
      prev.autor === m.autor &&
      (new Date(m.hora).getTime() - new Date(prev.hora).getTime()) < GROUP_WINDOW_MS
    items.push({ kind: 'msg', id: m.id, msg: m, grouped })
    prev = m
  }
  return items
}

function Thread({ thread, msgs, enviando, erroEnvio, onSend, texto, setTexto, composerRef }: ThreadProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.id, msgs.length])

  // Auto-resize do textarea (até ~5 linhas). Roda sempre que texto muda,
  // incluindo quando a IA injeta uma sugestão via setTexto externo.
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [texto, composerRef])

  async function submit() {
    if (!texto.trim() || enviando) return
    const r = await onSend(texto)
    if (r) setTexto('')
  }

  const items = useMemo(() => buildChatItems(msgs), [msgs])

  return (
    <>
      <header className={styles.threadHead}>
        <span className={styles.avatarLg}>{(thread.contato_nome || thread.contato_phone).slice(0, 1)}</span>
        <div className={styles.threadHeadBody}>
          <span className={styles.threadName}>{thread.contato_nome || thread.contato_phone}</span>
          <span className={styles.threadSub}>
            {thread.contato_phone || '—'} · via {thread.origem}
          </span>
        </div>
        <span className={`${styles.tag} ${styles['t_' + STATUS_TONE[thread.status]]}`}>
          {STATUS_LABEL[thread.status]}
        </span>
      </header>

      <div className={styles.threadBody} ref={scrollRef}>
        {items.length === 0 ? (
          <p className={styles.threadEmpty}>Sem mensagens ainda.</p>
        ) : (
          items.map((it) =>
            it.kind === 'divider' ? (
              <div key={it.id} className={styles.dateDivider}>
                <span>{fmtDivisor(it.dateISO)}</span>
              </div>
            ) : (
              <Bubble key={it.id} m={it.msg} grouped={it.grouped} />
            ),
          )
        )}
      </div>

      {erroEnvio && <div className={styles.janelaAviso}>Erro: {erroEnvio}</div>}

      <footer className={styles.composer}>
        <textarea
          ref={composerRef}
          className={styles.composerInput}
          placeholder="Escreva sua resposta…  (Shift+Enter pra quebrar linha)"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          disabled={enviando}
          rows={1}
        />
        <button
          className={styles.composerBtn}
          type="button"
          disabled={enviando || !texto.trim()}
          onClick={submit}
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </footer>
    </>
  )
}

function Bubble({ m, grouped }: { m: WhatsAppMsgReal; grouped: boolean }) {
  const isMe = m.autor === 'atendente'
  return (
    <div className={`${styles.bubbleRow} ${isMe ? styles.bubbleRowMe : ''} ${grouped ? styles.bubbleRowGrouped : ''}`}>
      <div
        className={
          `${styles.bubble} ${isMe ? styles.bubbleMe : styles.bubbleThem} ${grouped ? styles.bubbleGrouped : ''}`
        }
      >
        <p className={styles.bubbleText}>{m.texto}</p>
        <span className={styles.bubbleMeta}>
          <span className={styles.bubbleTime}>{fmtHora(m.hora)}</span>
          {isMe && <Tick status={m.status} />}
        </span>
      </div>
    </div>
  )
}

function Tick({ status }: { status: WhatsAppMsgStatus }) {
  if (status === 'erro') return <span className={styles.tickErro} title="Erro no envio">!</span>
  if (status === 'lida') return <span className={`${styles.tick} ${styles.tickLida}`} title="Lida">✓✓</span>
  if (status === 'entregue') return <span className={styles.tick} title="Entregue">✓✓</span>
  return <span className={styles.tick} title="Enviada">✓</span>
}

function EmptyThread() {
  return (
    <div className={styles.threadEmptyState}>
      <p>Selecione uma conversa pra ver as mensagens.</p>
    </div>
  )
}

function ContactPanel({ thread, totalMsgs }: { thread: WhatsAppThreadReal; totalMsgs: number }) {
  return (
    <>
      <div className={styles.contactHead}>
        <span className={styles.avatarLg}>{(thread.contato_nome || thread.contato_phone).slice(0, 1)}</span>
        <span className={styles.contactName}>{thread.contato_nome || thread.contato_phone}</span>
        <span className={styles.contactPhone}>{thread.contato_phone || '—'}</span>
      </div>
      <dl className={styles.contactList}>
        <div className={styles.contactItem}>
          <dt>Status</dt>
          <dd>
            <span className={`${styles.tag} ${styles['t_' + STATUS_TONE[thread.status]]}`}>
              {STATUS_LABEL[thread.status]}
            </span>
          </dd>
        </div>
        <div className={styles.contactItem}>
          <dt>Origem</dt>
          <dd>{thread.origem}</dd>
        </div>
        <div className={styles.contactItem}>
          <dt>Última atividade</dt>
          <dd>{fmtData(thread.ultima_atividade)} {fmtHora(thread.ultima_atividade)}</dd>
        </div>
        <div className={styles.contactItem}>
          <dt>Mensagens</dt>
          <dd>{totalMsgs}</dd>
        </div>
      </dl>
    </>
  )
}

function fmtHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function fmtData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch { return iso }
}

function mesmoDia(a: string, b: string): boolean {
  const da = new Date(a); const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

function fmtDivisor(iso: string): string {
  try {
    const d = new Date(iso)
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
    const alvo = new Date(d);  alvo.setHours(0, 0, 0, 0)
    const diffDias = Math.round((hoje.getTime() - alvo.getTime()) / 86400000)
    if (diffDias === 0) return 'HOJE'
    if (diffDias === 1) return 'ONTEM'
    if (diffDias > 1 && diffDias < 7) {
      return d.toLocaleDateString('pt-BR', { weekday: 'long' })
        .replace(/-feira$/, '')
        .toUpperCase()
    }
    const mesmoAno = d.getFullYear() === hoje.getFullYear()
    return d.toLocaleDateString('pt-BR', mesmoAno
      ? { day: '2-digit', month: 'long' }
      : { day: '2-digit', month: 'long', year: 'numeric' },
    )
  } catch { return iso }
}
