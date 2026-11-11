import { useCallback, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAiBrain } from '@/features/ai'
import type { WhatsAppResumo } from '../api/types'

export interface CommercialReportPeriod {
  from: Date
  to: Date
}

interface SampleMsg {
  autor: 'cliente' | 'atendente'
  texto: string
  hora: string
}

interface SampleThread {
  contato_nome: string | null
  contato_phone: string
  status: string
  origem: string
  criado_em: string
  ultima_atividade: string
  ultima_msg_cliente_em: string | null
  msgs: SampleMsg[]
}

export interface CommercialReportResult {
  modelo?: string
  gerado_em?: string
  resumo?: string
  pontos_fortes?: string[]
  pontos_melhoria?: Array<{
    titulo: string
    descricao: string
    prioridade: 'alta' | 'media' | 'baixa'
  }>
  padroes?: Array<{
    padrao: string
    exemplos_resumidos: string[]
  }>
  acoes_prioritarias?: Array<{
    acao: string
    impacto_esperado: string
  }>
  amostra_contagem?: {
    vendas: number
    agendadas: number
    perdidas: number
    sla_ruim: number
  }
}

export interface UseCommercialReportReturn {
  running: boolean
  error: string | null
  result: CommercialReportResult | null
  run: (opts: {
    inboxPhone: string | null
    period: CommercialReportPeriod
    kpis: WhatsAppResumo
  }) => Promise<void>
  clear: () => void
}

interface RawThreadRow {
  id: string
  status: string
  origem: string | null
  inbox_phone: string | null
  criado_em: string
  ultima_atividade: string
  ultima_msg_cliente_em: string | null
  nao_lidas: number | null
  whatsapp_contatos: { nome: string | null; phone: string } | null
}

const VENDAS_LIMIT     = 5
const AGENDADAS_LIMIT  = 5
const PERDIDAS_LIMIT   = 10
const SLA_RUIM_LIMIT   = 10
const MSGS_POR_THREAD  = 20

function selectThreadsBase() {
  return supabase
    .from('whatsapp_threads')
    .select(`
      id, status, origem, inbox_phone, criado_em, ultima_atividade,
      ultima_msg_cliente_em, nao_lidas,
      whatsapp_contatos!inner ( nome, phone )
    `)
}

async function fetchBucket(
  builder: ReturnType<typeof selectThreadsBase>,
  inboxPhone: string | null,
): Promise<RawThreadRow[]> {
  let q = builder
  if (inboxPhone) q = q.eq('inbox_phone', inboxPhone)
  const { data, error } = await q
  if (error || !data) return []
  return data as unknown as RawThreadRow[]
}

export function useCommercialReport(): UseCommercialReportReturn {
  const { brain } = useAiBrain()
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CommercialReportResult | null>(null)

  const run = useCallback(async ({ inboxPhone, period, kpis }) => {
    setRunning(true)
    setError(null)
    try {
      const fromISO = period.from.toISOString()
      const toISO   = period.to.toISOString()
      const h24AgoISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

      // --- Buckets ---
      const [vendas, agendadas, perdidas, slaRuim] = await Promise.all([
        fetchBucket(
          selectThreadsBase()
            .eq('status', 'venda')
            .gte('ultima_atividade', fromISO)
            .lte('ultima_atividade', toISO)
            .order('ultima_atividade', { ascending: false })
            .limit(VENDAS_LIMIT),
          inboxPhone,
        ),
        fetchBucket(
          selectThreadsBase()
            .eq('status', 'agendado')
            .gte('ultima_atividade', fromISO)
            .lte('ultima_atividade', toISO)
            .order('ultima_atividade', { ascending: false })
            .limit(AGENDADAS_LIMIT),
          inboxPhone,
        ),
        fetchBucket(
          selectThreadsBase()
            .in('status', ['lead', 'aberta'])
            .gte('criado_em', fromISO)
            .lte('criado_em', toISO)
            .lt('ultima_atividade', h24AgoISO)
            .order('ultima_atividade', { ascending: false })
            .limit(PERDIDAS_LIMIT),
          inboxPhone,
        ),
        fetchBucket(
          selectThreadsBase()
            .gt('nao_lidas', 0)
            .gte('ultima_atividade', fromISO)
            .lte('ultima_atividade', toISO)
            .order('ultima_msg_cliente_em', { ascending: true, nullsFirst: false })
            .limit(SLA_RUIM_LIMIT),
          inboxPhone,
        ),
      ])

      const allThreadIds = [
        ...vendas, ...agendadas, ...perdidas, ...slaRuim,
      ].map((t) => t.id)

      // --- Msgs: uma query só pras N threads amostradas ---
      const msgsById = new Map<string, SampleMsg[]>()
      if (allThreadIds.length > 0) {
        const { data: msgRows } = await supabase
          .from('whatsapp_msgs')
          .select('thread_id, autor, texto, hora')
          .in('thread_id', Array.from(new Set(allThreadIds)))
          .order('hora', { ascending: true })

        for (const m of (msgRows || []) as Array<{
          thread_id: string; autor: 'cliente' | 'atendente'; texto: string; hora: string
        }>) {
          const arr = msgsById.get(m.thread_id) || []
          arr.push({ autor: m.autor, texto: m.texto, hora: m.hora })
          msgsById.set(m.thread_id, arr)
        }
      }

      const toSample = (rows: RawThreadRow[]): SampleThread[] =>
        rows.map((r) => {
          const allMsgs = msgsById.get(r.id) || []
          const tail = allMsgs.slice(-MSGS_POR_THREAD)
          return {
            contato_nome: r.whatsapp_contatos?.nome ?? null,
            contato_phone: r.whatsapp_contatos?.phone ?? '',
            status: r.status,
            origem: r.origem || 'desconhecida',
            criado_em: r.criado_em,
            ultima_atividade: r.ultima_atividade,
            ultima_msg_cliente_em: r.ultima_msg_cliente_em,
            msgs: tail,
          }
        })

      const amostras = {
        vendas:    toSample(vendas),
        agendadas: toSample(agendadas),
        perdidas:  toSample(perdidas),
        sla_ruim:  toSample(slaRuim),
      }

      const totalThreads =
        amostras.vendas.length + amostras.agendadas.length +
        amostras.perdidas.length + amostras.sla_ruim.length
      if (totalThreads === 0) {
        setError('Não há conversas suficientes no período pra gerar o relatório.')
        return
      }

      const { data, error: fnError } = await supabase.functions.invoke<CommercialReportResult>(
        'gemini-commercial-report',
        {
          body: {
            periodo: { from: fromISO, to: toISO },
            inbox_phone: inboxPhone,
            kpis,
            amostras,
            brain,
          },
        },
      )
      if (fnError) {
        setError(fnError.message || 'Falha ao chamar a IA.')
        return
      }
      if (!data) {
        setError('IA devolveu resposta vazia.')
        return
      }
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }, [brain])

  const clear = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { running, error, result, run, clear }
}
