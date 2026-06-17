import { useState, useCallback } from 'react'
import { seoRepo } from '../api/seoRepo'
import type { SeoKeywordResearch } from '../api/types'

export interface UseKeywordResearchReturn {
  result: SeoKeywordResearch | null
  loading: boolean
  error: string | null
  search: (termo: string) => Promise<void>
  reset: () => void
}

export function useKeywordResearch(): UseKeywordResearchReturn {
  const [result, setResult] = useState<SeoKeywordResearch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (termo: string) => {
    const clean = termo.trim()
    if (!clean) {
      setError('Digite uma palavra-chave para pesquisar.')
      setResult(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await seoRepo.researchKeyword(clean)
      setResult(r)
      if (!r) setError('Não foi possível obter dados para este termo.')
    } catch {
      setError('Erro ao buscar palavra-chave.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, loading, error, search, reset }
}
