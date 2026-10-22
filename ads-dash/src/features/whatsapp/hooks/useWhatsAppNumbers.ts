import { useState, useEffect, useCallback } from 'react'
import { whatsappRepo } from '../api/whatsappRepo'
import type { WhatsAppNumber, WhatsAppNumberInput } from '../api/types'

export interface UseWhatsAppNumbersReturn {
  numeros: WhatsAppNumber[]
  loading: boolean
  erro: string | null
  refresh: () => Promise<void>
  salvar: (id: string | null, input: WhatsAppNumberInput) => Promise<WhatsAppNumber>
  remover: (id: string) => Promise<void>
  togglarAtivo: (n: WhatsAppNumber) => Promise<void>
}

export function useWhatsAppNumbers(): UseWhatsAppNumbersReturn {
  const [numeros, setNumeros] = useState<WhatsAppNumber[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const list = await whatsappRepo.listarNumeros()
      setNumeros(list)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setNumeros([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const salvar = useCallback(async (id: string | null, input: WhatsAppNumberInput) => {
    const saved = await whatsappRepo.salvarNumero(id, input)
    await refresh()
    return saved
  }, [refresh])

  const remover = useCallback(async (id: string) => {
    await whatsappRepo.removerNumero(id)
    await refresh()
  }, [refresh])

  const togglarAtivo = useCallback(async (n: WhatsAppNumber) => {
    await whatsappRepo.salvarNumero(n.id, {
      rotulo: n.rotulo,
      display_number: n.display_number,
      provider: n.provider,
      phone_number_id: n.phone_number_id,
      waba_id: n.waba_id,
      zapi_instance_id: n.zapi_instance_id,
      ativo: !n.ativo,
    })
    await refresh()
  }, [refresh])

  return { numeros, loading, erro, refresh, salvar, remover, togglarAtivo }
}
