import { useState, FormEvent } from 'react'
import { useKeywordResearch } from '../hooks/useKeywordResearch'
import { seoRepo } from '../api/seoRepo'
import { fmtNumber } from '@/shared/lib/format'
import styles from './KeywordResearch.module.css'

const DIFICULDADE_TONE: Record<string, string> = {
  baixa: styles.diffBaixa,
  'média': styles.diffMedia,
  media: styles.diffMedia,
  alta:  styles.diffAlta,
}

interface Props {
  onAdded?: (termo: string) => void
}

export default function KeywordResearch({ onAdded }: Props) {
  const [termo, setTermo] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<string | null>(null)
  const { result, loading, error, search } = useKeywordResearch()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    search(termo)
  }

  async function handleAdd(t: string) {
    if (adding || added.has(t)) return
    setAdding(t)
    setFeedback(null)
    const res = await seoRepo.addMonitoredKeyword({ termo: t })
    setAdding(null)
    if (res.ok) {
      setAdded(prev => new Set(prev).add(t))
      setFeedback(`"${t}" adicionado ao monitoramento.`)
      onAdded?.(t)
    } else {
      setFeedback(res.error ?? 'Não foi possível adicionar.')
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Pesquisar palavras-chave</h2>

      <form className={styles.searchBox} onSubmit={onSubmit}>
        <input
          className={styles.input}
          type="text"
          placeholder="Ex.: mechas iluminadas, progressiva sem formol..."
          value={termo}
          onChange={e => setTermo(e.target.value)}
          aria-label="Termo para pesquisar"
        />
        <button className={styles.btn} type="submit" disabled={loading}>
          {loading ? 'Buscando...' : 'Pesquisar'}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}
      {feedback && <p className={styles.feedback}>{feedback}</p>}

      {result && !loading && (
        <div className={styles.card}>
          <header className={styles.resultHead}>
            <div>
              <span className={styles.resultLabel}>Resultado para</span>
              <h3 className={styles.resultTermo}>{result.termo}</h3>
            </div>
            <span className={styles.intent}>{result.intent}</span>
          </header>

          <div className={styles.metricGrid}>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Volume / mês</span>
              <span className={styles.metricVal}>{fmtNumber(result.volume)}</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Dificuldade</span>
              <span className={`${styles.metricChip} ${DIFICULDADE_TONE[result.dificuldade] || ''}`}>
                {result.dificuldade}
              </span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>CPC estimado</span>
              <span className={styles.metricVal}>R$ {result.cpc.toFixed(2)}</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricLabel}>Tendência (90d)</span>
              <span className={result.tendencia >= 0 ? styles.trendUp : styles.trendDown}>
                {result.tendencia >= 0 ? '▲' : '▼'} {Math.abs(result.tendencia)}%
              </span>
            </div>
          </div>

          <div className={styles.split}>
            <div>
              <h4 className={styles.subTitle}>Ideias relacionadas</h4>
              <ul className={styles.ideias}>
                {result.ideias.map(i => (
                  <li key={i.termo} className={styles.ideiaRow}>
                    <span className={styles.ideiaTermo}>{i.termo}</span>
                    <span className={styles.ideiaVol}>{fmtNumber(i.volume)}</span>
                    <span className={`${styles.ideiaDiff} ${DIFICULDADE_TONE[i.dificuldade] || ''}`}>
                      {i.dificuldade}
                    </span>
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={() => handleAdd(i.termo)}
                      disabled={adding === i.termo || added.has(i.termo)}
                      aria-label={`Adicionar ${i.termo} ao monitoramento`}
                    >
                      {added.has(i.termo) ? '✓ monitorado' : adding === i.termo ? '...' : '+ monitorar'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className={styles.subTitle}>Perguntas frequentes</h4>
              <ul className={styles.perguntas}>
                {result.perguntas.map(p => (
                  <li key={p} className={styles.perguntaRow}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
