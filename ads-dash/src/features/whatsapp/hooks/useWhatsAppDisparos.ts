import { useState, useEffect, useCallback } from 'react'
import { whatsappRepo } from '../api/whatsappRepo'
import type {
  WhatsAppDisparoInput,
  WhatsAppDisparoResultado,
  WhatsAppDisparoHistorico,
} from '../api/types'

export interface UseWhatsAppDisparosReturn {
  historico: WhatsAppDisparoHistorico[]
  ultimoResultado: WhatsAppDisparoResultado | null
  enviando: boolean
  erro: string | null
  disparar: (input: WhatsAppDisparoInput) => Promise<WhatsAppDisparoResultado | null>
  recarregar: () => Promise<void>
}

export function useWhatsAppDisparos(): UseWhatsAppDisparosReturn {
  const [historico, setHistorico] = useState<WhatsAppDisparoHistorico[]>([])
  const [ultimoResultado, setUltimoResultado] = useState<WhatsAppDisparoResultado | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const lista = await whatsappRepo.listarDisparos(20)
      setHistorico(lista)
    } catch {
      setHistorico([])
    }
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  const disparar = useCallback(async (input: WhatsAppDisparoInput) => {
    setEnviando(true)
    setErro(null)
    try {
      const r = await whatsappRepo.enviarDisparo(input)
      setUltimoResultado(r)
      await recarregar()
      return r
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErro(msg)
      return null
    } finally {
      setEnviando(false)
    }
  }, [recarregar])

  return { historico, ultimoResultado, enviando, erro, disparar, recarregar }
}
