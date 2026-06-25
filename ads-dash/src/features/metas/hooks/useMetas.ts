import { useState, useEffect, useCallback, useMemo } from 'react'
import { metasRepo } from '../api/metasRepo'
import { refAtual } from '../lib/periodo'
import type { MetaKpi, MetaPeriodo, MetaUpsertInput } from '../api/types'
import { KPIS_PADRAO } from '../api/types'

export interface UseMetasOptions {
  periodo: MetaPeriodo
  periodoRef?: string  // default = corrente
}

export interface UseMetasReturn {
  metas: MetaKpi[]
  loading: boolean
  periodoRef: string
  upsert: (input: Omit<MetaUpsertInput, 'periodo' | 'periodo_ref'>) => Promise<void>
  refresh: () => Promise<void>
}

export function useMetas({ periodo, periodoRef }: UseMetasOptions): UseMetasReturn {
  const ref = useMemo(() => periodoRef || refAtual(periodo), [periodo, periodoRef])
  const [metas, setMetas] = useState<MetaKpi[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await metasRepo.listarPorPeriodo(periodo, ref)
      // Mescla com KPIS_PADRAO pra KPIs sem linha no banco aparecerem como "sem meta".
      const mapados = new Map(list.map(m => [m.kpi, m]))
      const completo = KPIS_PADRAO.map((def): MetaKpi => {
        const existente = mapados.get(def.kpi)
        if (existente) {
          return {
            ...existente,
            label: existente.label || def.label,
            ordem: existente.ordem || def.ordem,
            unidade: existente.unidade || def.unidade,
          }
        }
        return {
          id: `placeholder-${def.kpi}`,
          kpi: def.kpi,
          label: def.label,
          unidade: def.unidade,
          ordem: def.ordem,
          valor_meta: 0,
          valor_meta_min: null,
          valor_meta_max: null,
          valor_realizado: 0,
        }
      })
      setMetas(completo)
    } catch {
      setMetas([])
    } finally {
      setLoading(false)
    }
  }, [periodo, ref])

  useEffect(() => { refresh() }, [refresh])

  const upsert = useCallback(async (input: Omit<MetaUpsertInput, 'periodo' | 'periodo_ref'>) => {
    await metasRepo.upsert({ ...input, periodo, periodo_ref: ref })
    await refresh()
  }, [periodo, ref, refresh])

  return { metas, loading, periodoRef: ref, upsert, refresh }
}
