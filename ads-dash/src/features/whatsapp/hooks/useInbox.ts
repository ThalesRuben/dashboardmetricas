import { useState, useEffect, useCallback, useRef } from 'react'
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

export function useInbox(): UseInboxReturn {
  const [threads, setThreads] = useState<WhatsAppThreadReal[]>([])
  const [msgs, setMsgs] = useState<WhatsAppMsgReal[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const realtime = getDataSource() === 'supabase'
  const activeIdRef = useRef<string | null>(null)
  activeIdRef.current = activeId

  const reloadThreads = useCallback(async () => {
    try {
      const t = await whatsappRepo.listarThreads(50)
      setThreads(t)
    } catch {
      setThreads([])
    }
  }, [])

  useEffect(() => { reloadThreads() }, [reloadThreads])

  // Auto-seleciona a primeira thread se não tem ativa
  useEffect(() => {
    if (!activeId && threads.length > 0) setActiveId(threads[0].id)
  }, [threads, activeId])

  // Carrega mensagens da thread ativa
  useEffect(() => {
    if (!activeId) { setMsgs([]); return }
    let cancelled = false
    whatsappRepo.listarMsgs(activeId).then((m) => {
      if (!cancelled) setMsgs(m)
    })
    // Marca como lido ao abrir
    whatsappRepo.marcarLido(activeId).catch(() => {})
    return () => { cancelled = true }
  }, [activeId])

  // Realtime: assina inserts em whatsapp_msgs e whatsapp_threads
  useEffect(() => {
    if (!realtime) return
    const channel = supabase
      .channel('inbox-rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whatsapp_msgs' },
        (payload) => {
          const nova = payload.new as WhatsAppMsgReal
          if (nova.thread_id === activeIdRef.current) {
            setMsgs((prev) => (prev.find((m) => m.id === nova.id) ? prev : [...prev, nova]))
          }
          // Sempre recarrega lista de threads (atualiza preview/contador)
          reloadThreads()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'whatsapp_threads' },
        () => { reloadThreads() },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [realtime, reloadThreads])

  const enviar = useCallback(async (texto: string): Promise<ReplyResultado | null> => {
    if (!activeId || !texto.trim()) return null
    setEnviando(true)
    setErroEnvio(null)
    try {
      const r = await whatsappRepo.enviarResposta(activeId, texto.trim())
      if (!r.ok) {
        setErroEnvio(r.erro || 'Falha ao enviar')
        return r
      }
      // Recarrega msgs da thread (otimisticamente; realtime também vai chegar)
      const m = await whatsappRepo.listarMsgs(activeId)
      setMsgs(m)
      return r
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErroEnvio(msg)
      return null
    } finally {
      setEnviando(false)
    }
  }, [activeId])

  const activeThread = threads.find((t) => t.id === activeId) || null

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
