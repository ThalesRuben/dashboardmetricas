import { useState, useEffect, useCallback, useRef, useId, useMemo } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { whatsappRepo } from '../api/whatsappRepo'
import { getDataSource } from '@/shared/lib/api/createRepo'
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

// Consolida várias threads do mesmo contato numa única entrada "representativa".
// Necessário porque o inbox-ingest cria thread nova sempre que a anterior está
// arquivada e, na prática, a operação acaba com várias threads do mesmo número.
// Mantemos a mais recente como capa, somamos nao_lidas e priorizamos status
// "vivo" (lead > agendado > venda > aberta > arquivada).
const STATUS_PESO: Record<WhatsAppThreadReal['status'], number> = {
  lead:      5,
  agendado:  4,
  aberta:    3,
  venda:     2,
  arquivada: 1,
}

function consolidarPorContato(raw: WhatsAppThreadReal[]): WhatsAppThreadReal[] {
  const porContato = new Map<string, WhatsAppThreadReal>()
  for (const t of raw) {
    const atual = porContato.get(t.contato_id)
    if (!atual) {
      porContato.set(t.contato_id, { ...t })
      continue
    }
    // soma nao_lidas
    atual.nao_lidas = (atual.nao_lidas || 0) + (t.nao_lidas || 0)
    // mantém última atividade mais recente + preview correspondente
    if (t.ultima_atividade > atual.ultima_atividade) {
      atual.ultima_atividade = t.ultima_atividade
      atual.ultima_msg_preview = t.ultima_msg_preview
      atual.id = t.id // id da thread mais recente vira a "capa"
    }
    if (
      t.ultima_msg_cliente_em &&
      (!atual.ultima_msg_cliente_em || t.ultima_msg_cliente_em > atual.ultima_msg_cliente_em)
    ) {
      atual.ultima_msg_cliente_em = t.ultima_msg_cliente_em
    }
    // status mais "vivo" ganha
    if (STATUS_PESO[t.status] > STATUS_PESO[atual.status]) {
      atual.status = t.status
    }
    // contato_nome / phone — prefere o que tem nome preenchido
    if (!atual.contato_nome && t.contato_nome) atual.contato_nome = t.contato_nome
  }
  return Array.from(porContato.values()).sort(
    (a, b) => (a.ultima_atividade < b.ultima_atividade ? 1 : -1),
  )
}

export function useInbox(): UseInboxReturn {
  const [threadsRaw, setThreadsRaw] = useState<WhatsAppThreadReal[]>([])
  const [msgs, setMsgs] = useState<WhatsAppMsgReal[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const realtime = getDataSource() === 'supabase'
  const channelId = useId()

  const threads = useMemo(() => consolidarPorContato(threadsRaw), [threadsRaw])

  // Mapa thread_id (qualquer uma) → contato_id, pra realtime decidir se a msg
  // pertence à conversa ativa mesmo vindo de thread "irmã".
  const threadToContato = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of threadsRaw) m.set(t.id, t.contato_id)
    return m
  }, [threadsRaw])

  const activeThread = threads.find((t) => t.id === activeId) || null
  const activeContatoIdRef = useRef<string | null>(null)
  activeContatoIdRef.current = activeThread?.contato_id ?? null

  const reloadThreads = useCallback(async () => {
    try {
      const t = await whatsappRepo.listarThreads(200)
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

  // Carrega mensagens do CONTATO ativo (junta todas as threads dele)
  useEffect(() => {
    if (!activeThread) { setMsgs([]); return }
    let cancelled = false
    whatsappRepo.listarMsgsPorContato(activeThread.contato_id).then((m) => {
      if (!cancelled) setMsgs(m)
    })
    whatsappRepo.marcarLidoContato(activeThread.contato_id).catch(() => {})
    return () => { cancelled = true }
  }, [activeThread?.contato_id])

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
          const contatoDaMsg = threadToContato.get(nova.thread_id)
          if (contatoDaMsg && contatoDaMsg === activeContatoIdRef.current) {
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
  }, [realtime, reloadThreads, channelId, threadToContato])

  const enviar = useCallback(async (texto: string): Promise<ReplyResultado | null> => {
    if (!activeThread || !texto.trim()) return null
    setEnviando(true)
    setErroEnvio(null)
    try {
      // Envia pela thread "capa" (a mais recente).
      const r = await whatsappRepo.enviarResposta(activeThread.id, texto.trim())
      if (!r.ok) {
        setErroEnvio(r.erro || 'Falha ao enviar')
        return r
      }
      // Recarrega msgs do contato (otimisticamente; realtime também vai chegar)
      const m = await whatsappRepo.listarMsgsPorContato(activeThread.contato_id)
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
