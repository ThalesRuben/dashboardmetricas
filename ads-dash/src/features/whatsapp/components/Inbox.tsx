import { useState, useMemo, useEffect, useRef } from 'react'
import type { WhatsAppConversa, WhatsAppConversaStatus, WhatsAppMensagem } from '../api/types'
import styles from './Inbox.module.css'

interface InboxProps {
  conversas: WhatsAppConversa[]
}

type Filter = 'todas' | 'nao_lidas' | 'leads' | 'agendados'

const STATUS_LABEL: Record<WhatsAppConversaStatus, string> = {
  lead:     'Lead',
  aberta:   'Aberta',
  agendado: 'Agendado',
  venda:    'Venda',
}

const STATUS_TONE: Record<WhatsAppConversaStatus, string> = {
  lead:     'amber',
  aberta:   'plain',
  agendado: 'accent',
  venda:    'success',
}

export default function Inbox({ conversas }: InboxProps) {
  const [filter, setFilter] = useState<Filter>('todas')
  const [activeId, setActiveId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'nao_lidas') return conversas.filter(c => (c.nao_lidas || 0) > 0)
    if (filter === 'leads')     return conversas.filter(c => c.status === 'lead')
    if (filter === 'agendados') return conversas.filter(c => c.status === 'agendado')
    return conversas
  }, [conversas, filter])

  useEffect(() => {
    if (!filtered.length) { setActiveId(null); return }
    if (!activeId || !filtered.find(c => c.id === activeId)) {
      setActiveId(filtered[0].id || null)
    }
  }, [filtered, activeId])

  const active = useMemo(
    () => conversas.find(c => c.id === activeId) || null,
    [conversas, activeId],
  )

  const naoLidas = conversas.reduce((acc, c) => acc + (c.nao_lidas || 0), 0)

  return (
    <div className={styles.inbox}>
      <aside className={styles.listPane}>
        <div className={styles.listHead}>
          <span className={styles.listTitle}>Conversas</span>
          {naoLidas > 0 && <span className={styles.headBadge}>{naoLidas} não lidas</span>}
        </div>
        <div className={styles.filters}>
          {(['todas', 'nao_lidas', 'leads', 'agendados'] as Filter[]).map(f => (
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
          {filtered.map(c => (
            <li
              key={c.id}
              className={`${styles.listItem} ${c.id === activeId ? styles.listItemActive : ''}`}
              onClick={() => setActiveId(c.id || null)}
            >
              <span className={styles.avatar}>{c.nome.slice(0, 1)}</span>
              <div className={styles.listBody}>
                <div className={styles.listTop}>
                  <span className={styles.listName}>{c.nome}</span>
                  <span className={styles.listTime}>{c.hora}</span>
                </div>
                <div className={styles.listBottom}>
                  <span className={styles.listPreview}>{lastPreview(c)}</span>
                  {(c.nao_lidas || 0) > 0 && (
                    <span className={styles.unread}>{c.nao_lidas}</span>
                  )}
                </div>
                <div className={styles.listMeta}>
                  <span className={`${styles.tag} ${styles['t_' + STATUS_TONE[c.status]]}`}>{STATUS_LABEL[c.status]}</span>
                  <span className={styles.metaOrigem}>via {c.origem}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <section className={styles.threadPane}>
        {active ? <Thread conversa={active} /> : <EmptyThread />}
      </section>

      <aside className={styles.contactPane}>
        {active ? <ContactPanel conversa={active} /> : null}
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

function lastPreview(c: WhatsAppConversa): string {
  const last = c.mensagens?.[c.mensagens.length - 1]
  if (!last) return c.resumo
  const prefix = last.autor === 'atendente' ? 'Você: ' : ''
  return prefix + last.texto
}

function Thread({ conversa }: { conversa: WhatsAppConversa }) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [conversa.id])

  const mensagens = conversa.mensagens || []

  return (
    <>
      <header className={styles.threadHead}>
        <span className={styles.avatarLg}>{conversa.nome.slice(0, 1)}</span>
        <div className={styles.threadHeadBody}>
          <span className={styles.threadName}>{conversa.nome}</span>
          <span className={styles.threadSub}>
            {conversa.telefone || '—'} · via {conversa.origem}
          </span>
        </div>
        <span className={`${styles.tag} ${styles['t_' + STATUS_TONE[conversa.status]]}`}>
          {STATUS_LABEL[conversa.status]}
        </span>
      </header>

      <div className={styles.threadBody} ref={scrollRef}>
        <div className={styles.dateDivider}><span>Hoje</span></div>
        {mensagens.length === 0 ? (
          <p className={styles.threadEmpty}>Sem mensagens ainda.</p>
        ) : (
          mensagens.map((m, i) => <Bubble key={i} m={m} />)
        )}
      </div>

      <footer className={styles.composer}>
        <input
          className={styles.composerInput}
          placeholder="Envio desabilitado — plugue a WhatsApp Cloud API em Integrações"
          disabled
        />
        <button className={styles.composerBtn} type="button" disabled>Enviar</button>
      </footer>
    </>
  )
}

function Bubble({ m }: { m: WhatsAppMensagem }) {
  const isMe = m.autor === 'atendente'
  return (
    <div className={`${styles.bubbleRow} ${isMe ? styles.bubbleRowMe : ''}`}>
      <div className={`${styles.bubble} ${isMe ? styles.bubbleMe : styles.bubbleThem}`}>
        <p className={styles.bubbleText}>{m.texto}</p>
        <span className={styles.bubbleTime}>{m.hora}</span>
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

function ContactPanel({ conversa }: { conversa: WhatsAppConversa }) {
  return (
    <>
      <div className={styles.contactHead}>
        <span className={styles.avatarLg}>{conversa.nome.slice(0, 1)}</span>
        <span className={styles.contactName}>{conversa.nome}</span>
        <span className={styles.contactPhone}>{conversa.telefone || '—'}</span>
      </div>
      <dl className={styles.contactList}>
        <div className={styles.contactItem}>
          <dt>Status</dt>
          <dd>
            <span className={`${styles.tag} ${styles['t_' + STATUS_TONE[conversa.status]]}`}>
              {STATUS_LABEL[conversa.status]}
            </span>
          </dd>
        </div>
        <div className={styles.contactItem}>
          <dt>Origem</dt>
          <dd>{conversa.origem}</dd>
        </div>
        <div className={styles.contactItem}>
          <dt>Última atividade</dt>
          <dd>{conversa.hora}</dd>
        </div>
        <div className={styles.contactItem}>
          <dt>Mensagens</dt>
          <dd>{conversa.mensagens?.length ?? 0}</dd>
        </div>
        <div className={styles.contactItem}>
          <dt>Resumo</dt>
          <dd className={styles.contactResumo}>{conversa.resumo}</dd>
        </div>
      </dl>
    </>
  )
}
