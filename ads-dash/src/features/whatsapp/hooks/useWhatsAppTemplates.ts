import { useState, useEffect, useCallback } from 'react'
import { whatsappRepo } from '../api/whatsappRepo'
import type {
  WhatsAppTemplate,
  WhatsAppTemplateInput,
  WhatsAppTemplateCreateResult,
  WhatsAppTemplateSyncResult,
} from '../api/types'

export interface UseWhatsAppTemplatesReturn {
  templates: WhatsAppTemplate[]
  loading: boolean
  erro: string | null
  refresh: () => Promise<void>
  criar: (input: WhatsAppTemplateInput) => Promise<WhatsAppTemplateCreateResult>
  remover: (id: string, hard?: boolean) => Promise<void>
  sincronizar: () => Promise<WhatsAppTemplateSyncResult>
}

export function useWhatsAppTemplates(): UseWhatsAppTemplatesReturn {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const list = await whatsappRepo.listarTemplates()
      setTemplates(list)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const criar = useCallback(async (input: WhatsAppTemplateInput) => {
    const r = await whatsappRepo.criarTemplate(input)
    await refresh()
    return r
  }, [refresh])

  const remover = useCallback(async (id: string, hard = false) => {
    await whatsappRepo.removerTemplate(id, hard)
    await refresh()
  }, [refresh])

  const sincronizar = useCallback(async () => {
    const r = await whatsappRepo.sincronizarTemplates()
    await refresh()
    return r
  }, [refresh])

  return { templates, loading, erro, refresh, criar, remover, sincronizar }
}
