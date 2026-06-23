import { useState, useEffect, useCallback, useRef, useId, useMemo } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { whatsappRepo } from '../api/whatsappRepo'
import { getDataSource } from '@/shared/lib/api/createRepo'
import { normalizarPhoneBR } from '../lib/phone'
import type {
  WhatsAppThreadReal,
  WhatsAppMsgReal,
  ReplyResultado,
} from '../api/types'

export interface UseInboxReturn {
  threads: WhatsAppThreadReal[]
  msgs: WhatsAppMsgReal[]
  activeThread: WhatsAppThreadReal | null
  setActiveId: (id: string | null) => void
  enviando: boolean
  erroEnvio: string | null
  enviar: (texto: string) => Promise<ReplyResultado | null>
  reloadThreads: () => Promise<void>
  realtime: boolean
}

export interface UseInboxOptions {
  /** Filtra threads pelo número WhatsApp Business que recebeu a msg. */
  inboxPhone?: string | null
}

// Consolida várias threads do mesmo cliente (que vêm como contatos/threads
// duplicados no banco por causa de normalização inconsistente do telefone
// no n8n) numa única entrada "representativa".
const STATUS_PESO: Record<WhatsAppThreadReal['status'], number> = {
  lead:      5,
  agendado:  4,
  aberta:    3,
  venda:     2,
  arquivada: 1,
}

interface ConsolidatedThread extends WhatsAppThreadReal {
  // Todos os contato_ids que mapeiam pro mesmo phone normalizado.
  _contatoIds: string[]
  _phoneKey: string
}

function consolidarPorPhone(raw: WhatsAppThreadReal[]): ConsolidatedThread[] {
  const porPhone = new Map<string, ConsolidatedThread>()
  for (const t of raw) {
    const phoneKey = normalizarPhoneBR(t.contato_phone) || t.contato_id
    const atual = porPhone.get(phoneKey)
    if (!atual) {
      porPhone.set(phoneKey, { ...t, _contatoIds: [t.contato_id], _phoneKey: phoneKey })
      continue
    }
    if (!atual._contatoIds.includes(t.contato_id)) atual._contatoIds.push(t.contato_id)
    atual.nao_lidas = (atual.nao_lidas || 0) + (t.nao_lidas || 0)
    if (t.ultima_atividade > atual.ultima_atividade) {
      atual.ultima_atividade = t.ultima_atividade
      atual.ultima_msg_preview = t.ultima_msg_preview
      atual.id = t.id // id da thread mais recente vira a "capa"
      atual.contato_id = t.contato_id
    }
    if (
      t.ultima_msg_cliente_em &&
      (!atual.ultima_msg_cliente_em || t.ultima_msg_cliente_em > atual.ultima_msg_cliente_em)
    ) {
      atual.ultima_msg_cliente_em = t.ultima_msg_cliente_em
    }
    if (STATUS_PESO[t.status] > STATUS_PESO[atual.status]) {
      atual.status = t.status
    }
    if (!atual.contato_nome && t.contato_nome) atual.contato_nome = t.contato_nome
  }
  return Array.from(porPhone.values()).sort(
    (a, b) => (a.ultima_atividade < b.ultima_atividade ? 1 : -1),
  )
}

export function useInbox(options: UseInboxOptions = {}): UseInboxReturn {
  const { inboxPhone } = options
  const [threadsRaw, setThreadsRaw] = useState<WhatsAppThreadReal[]>([])
  const [msgs, setMsgs] = useState<WhatsAppMsgReal[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const realtime = getDataSource() === 'supabase'
  const channelId = useId()

  // Filtra ANTES de consolidar — mesmo cliente que mandou pros 2 números
  // precisa virar 2 threads separados na UI, não uma fusão.
  const threadsFiltradas = useMemo(() => {
    if (!inboxPhone) return threadsRaw
    return threadsRaw.filter((t) => t.inbox_phone === inboxPhone)
  }, [threadsRaw, inboxPhone])

  const threads = useMemo(() => consolidarPorPhone(threadsFiltradas), [threadsFiltradas])

  // Mapa thread_id (qualquer uma) → phoneKey, pra realtime decidir se a msg
  // pertence à conversa ativa mesmo vindo de thread/contato "irmão".
  // Usa as threads JÁ FILTRADAS por inbox — assim, se o user está visualizando
  // só o inbox A, mensagens novas no inbox B não pulam pra tela ativa.
  const threadToPhoneKey = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of threadsFiltradas) {
      m.set(t.id, normalizarPhoneBR(t.contato_phone) || t.contato_id)
    }
    return m
  }, [threadsFiltradas])

  const activeThread = threads.find((t) => t.id === activeId) || null
  const activePhoneKeyRef = useRef<string | null>(null)
  activePhoneKeyRef.current = activeThread?._phoneKey ?? null

  const reloadThreads = useCallback(async () => {
    try {
      const t = await whatsappRepo.listarThreads(300)
      setThreadsRaw(t)
    } catch {
      setThreadsRaw([])
    }
  }, [])

  useEffect(() => { reloadThreads() }, [reloadThreads])

  // Auto-seleciona a primeira thread se não tem ativa
  useEffect(() => {
    if (!activeId && threads.length > 0) setActiveId(threads[0].id)
  }, [threads, activeId])

  // Carrega mensagens de TODOS os contatos do phone ativo.
  useEffect(() => {
    if (!activeThread) { setMsgs([]); return }
    let cancelled = false
    const ids = activeThread._contatoIds
    whatsappRepo.listarMsgsPorContatos(ids).then((m) => {
      if (!cancelled) setMsgs(m)
    })
    whatsappRepo.marcarLidoContatos(ids).catch(() => {})
    return () => { cancelled = true }
  }, [activeThread?._phoneKey])

  // Realtime: assina inserts em whatsapp_msgs e whatsapp_threads
  useEffect(() => {
    if (!realtime) return
    const channel = supabase
      .channel(`inbox-rt-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_msgs' },
        (payload) => {
          const nova = payload.new as WhatsAppMsgReal
          const phoneKeyDaMsg = threadToPhoneKey.get(nova.thread_id)
          if (phoneKeyDaMsg && phoneKeyDaMsg === activePhoneKeyRef.current) {
            setMsgs((prev) => (prev.find((m) => m.id === nova.id) ? prev : [...prev, nova]))
          }
          // Sempre recarrega lista de threads (atualiza preview/contador, descobre threads novas)
          reloadThreads()
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_threads' },
        () => { reloadThreads() },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_threads' },
        () => { reloadThreads() },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [realtime, reloadThreads, channelId, threadToPhoneKey])

  const enviar = useCallback(async (texto: string): Promise<ReplyResultado | null> => {
    if (!activeThread || !texto.trim()) return null
    setEnviando(true)
    setErroEnvio(null)
    try {
      const r = await whatsappRepo.enviarResposta(activeThread.id, texto.trim())
      if (!r.ok) {
        setErroEnvio(r.erro || 'Falha ao enviar')
        return r
      }
      const m = await whatsappRepo.listarMsgsPorContatos(activeThread._contatoIds)
      setMsgs(m)
      return r
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErroEnvio(msg)
      return null
    } finally {
      setEnviando(false)
    }
  }, [activeThread])

  return {
    threads,
    msgs,
    activeThread,
    setActiveId,
    enviando,
    erroEnvio,
    enviar,
    reloadThreads,
    realtime,
  }
}
