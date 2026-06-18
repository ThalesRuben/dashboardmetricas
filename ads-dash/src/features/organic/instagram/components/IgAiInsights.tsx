import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAiBrain } from '@/features/ai'
import { generateInstagramInsights, type Insight } from '@/lib/aiInsights'
import type { IgData } from '@/app/providers/MetricsContext'
import styles from './IgAiInsights.module.css'

interface PlanoItem {
  dia: string
  formato: string
  tema: string
  gancho: string
}

interface AiResult {
  modelo?: string
  resumo?: string
  insights: Insight[]
  hipoteses?: string[]
  plano_7d?: PlanoItem[]
  alertas?: string[]
  gerado_em?: string
}

const TONE_ICON: Record<string, string> = {
  success: '✓',
  warning: '⚠',
  danger: '⛔',
  info: 'ℹ',
}

interface IgAiInsightsProps {
  ig: IgData
}

export default function IgAiInsights({ ig }: IgAiInsightsProps) {
  const { brain } = useAiBrain()
  const [result, setResult] = useState<AiResult | null>(null)
  const [source, setSource] = useState<'ai' | 'local' | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke<AiResult>(
        'gemini-instagram-insights',
        { body: { ig, brain } },
      )
      if (!fnError && data?.insights?.length) {
        setResult(data)
        setSource('ai')
      } else {
        setResult({ insights: generateInstagramInsights(ig) })
        setSource('local')
        if (fnError) setError('IA indisponível — usando análise por regras.')
      }
    } catch {
      setResult({ insights: generateInstagramInsights(ig) })
      setSource('local')
      setError('IA indisponível — usando análise por regras.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <div className={styles.aiIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4" />
              <path d="M5 8h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z" />
              <circle cx="9" cy="13" r="1" fill="currentColor" />
              <circle cx="15" cy="13" r="1" fill="currentColor" />
              <path d="M9 17h6" />
            </svg>
          </div>
          <div>
            <h3 className={styles.title}>Insights estratégicos da IA</h3>
            <p className={styles.sub}>
              {result
                ? `gerado ${result.gerado_em ? new Date(result.gerado_em).toLocaleString('pt-BR') : 'agora'}`
                : 'análise completa da conta com plano de conteúdo'}
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          {source && (
            <span className={`${styles.source} ${source === 'ai' ? styles.sourceAi : styles.sourceLocal}`}>
              {source === 'ai' ? 'Gemini' : 'Regras locais'}
            </span>
          )}
          <button className={styles.btn} onClick={run} disabled={running}>
            {running ? 'Analisando...' : result ? '↻ Reanalisar' : '▸ Gerar insights'}
          </button>
        </div>
      </div>

      {running && (
        <div className={styles.loadingBox}>
          <span className={styles.spinner} />
          A IA está lendo as métricas e os últimos posts...
        </div>
      )}

      {!result && !running && (
        <div className={styles.empty}>
          <p>Clique em <strong>Gerar insights</strong> pra a IA analisar a conta inteira.</p>
          <p>Ela cruza seguidores, engajamento, alcance e os últimos posts com o <strong>Cérebro da IA</strong> (Central de IA → Cérebro) e devolve um plano estratégico — não só métricas.</p>
        </div>
      )}

      {result && (
        <>
          {error && <div className={styles.empty}>{error}</div>}

          {result.resumo && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Resumo da conta</h3>
              <p className={styles.resumo}>{result.resumo}</p>
            </div>
          )}

          {!!result.insights?.length && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Recomendações ({result.insights.length})</h3>
              <div className={styles.insightsGrid}>
                {result.insights.map((ins, i) => (
                  <div key={i} className={`${styles.insight} ${styles[`tone-${ins.tone}`]}`}>
                    <span className={styles.insightIcon}>{TONE_ICON[ins.tone] || 'ℹ'}</span>
                    <div>
                      <div className={styles.insightTitle}>{ins.title}</div>
                      <div className={styles.insightBody}>{ins.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!result.hipoteses?.length && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Hipóteses do que está performando</h3>
              <ul className={styles.list}>
                {result.hipoteses.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </div>
          )}

          {!!result.plano_7d?.length && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Plano de conteúdo — próximos 7 dias</h3>
              <div className={styles.plano}>
                {result.plano_7d.map((p, i) => (
                  <div key={i} className={styles.planoRow}>
                    <span className={styles.planoDia}>{p.dia}</span>
                    <span className={styles.planoFormato}>{p.formato}</span>
                    <div className={styles.planoCont}>
                      <span className={styles.planoTema}>{p.tema}</span>
                      <span className={styles.planoGancho}>"{p.gancho}"</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!result.alertas?.length && (
            <div className={`${styles.card} ${styles.alerta}`}>
              <h3 className={styles.cardTitle}>Alertas críticos</h3>
              <ul className={styles.list}>
                {result.alertas.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
