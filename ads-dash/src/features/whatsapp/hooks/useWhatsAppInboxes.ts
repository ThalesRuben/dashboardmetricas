import { useState, useEffect, useCallback } from 'react'
import { whatsappRepo } from '../api/whatsappRepo'
import type { WhatsAppInbox } from '../api/types'

export interface UseWhatsAppInboxesReturn {
  inboxes: WhatsAppInbox[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useWhatsAppInboxes(): UseWhatsAppInboxesReturn {
  const [inboxes, setInboxes] = useState<WhatsAppInbox[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await whatsappRepo.listarInboxes()
      setInboxes(list)
    } catch {
      setInboxes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { inboxes, loading, refresh }
}
