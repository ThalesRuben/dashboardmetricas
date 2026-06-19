import { useState, useMemo, useEffect, useRef } from 'react'
import { useInbox } from '../hooks/useInbox'
import type {
  WhatsAppThreadReal,
  WhatsAppMsgReal,
  WhatsAppThreadStatusReal,
} from '../api/types'
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

const JANELA_MS = 24 * 60 * 60 * 1000

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
          />
        ) : (
          <EmptyThread />
        )}
      </section>

      <aside className={styles.contactPane}>
        {activeThread ? <ContactPanel thread={activeThread} totalMsgs={msgs.length} /> : null}
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
}

function Thread({ thread, msgs, enviando, erroEnvio, onSend }: ThreadProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [texto, setTexto] = useState('')

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thread.id, msgs.length])

  const janelaAberta = !!thread.ultima_msg_cliente_em
    && (Date.now() - new Date(thread.ultima_msg_cliente_em).getTime()) < JANELA_MS

  async function submit() {
    if (!texto.trim() || enviando) return
    const r = await onSend(texto)
    if (r) setTexto('')
  }

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
        <div className={styles.dateDivider}><span>{fmtData(thread.ultima_atividade)}</span></div>
        {msgs.length === 0 ? (
          <p className={styles.threadEmpty}>Sem mensagens ainda.</p>
        ) : (
          msgs.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>

      {!janelaAberta && (
        <div className={styles.janelaAviso}>
          Janela de 24h fechada. Use a aba <strong>Disparo em massa</strong> com um template HSM
          pra reabrir a conversa.
        </div>
      )}
      {erroEnvio && <div className={styles.janelaAviso}>Erro: {erroEnvio}</div>}

      <footer className={styles.composer}>
        <input
          className={styles.composerInput}
          placeholder={janelaAberta ? 'Escreva sua resposta…' : 'Janela fechada — use template'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          disabled={!janelaAberta || enviando}
        />
        <button
          className={styles.composerBtn}
          type="button"
          disabled={!janelaAberta || enviando || !texto.trim()}
          onClick={submit}
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </footer>
    </>
  )
}

function Bubble({ m }: { m: WhatsAppMsgReal }) {
  const isMe = m.autor === 'atendente'
  return (
    <div className={`${styles.bubbleRow} ${isMe ? styles.bubbleRowMe : ''}`}>
      <div className={`${styles.bubble} ${isMe ? styles.bubbleMe : styles.bubbleThem}`}>
        <p className={styles.bubbleText}>{m.texto}</p>
        <span className={styles.bubbleTime}>{fmtHora(m.hora)}</span>
      </div>
    </div>
  )
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
