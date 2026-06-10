import { useQuarterlyGoals } from '@/features/goals'
import { fmtNumber, fmtBRL, fmtRoas } from '@/shared/lib/format'
import styles from './QuarterlyGoals.module.css'

const STATUS = {
  fechado:   { label: 'Fechado',     tone: styles.stMuted },
  andamento: { label: 'Em andamento', tone: styles.stAccent },
  futuro:    { label: 'Planejado',   tone: styles.stFaint },
}

function fmtValue(v, unidade) {
  if (unidade === 'BRL') return fmtBRL(v)
  if (unidade === 'x')   return fmtRoas(v)
  return fmtNumber(v)
}

// fração do trimestre já decorrida (para julgar se a meta está no ritmo)
function timeProgress(periodo) {
  const map = { 'Jan': 0, 'Abr': 3, 'Jul': 6, 'Out': 9 }
  const startMonth = map[periodo.slice(0, 3)] ?? 0
  const now = new Date()
  const year = now.getFullYear()
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, startMonth + 3, 0)
  const frac = (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())
  return Math.max(0, Math.min(1, frac))
}

export default function QuarterlyGoals() {
  const { quarters, loading } = useQuarterlyGoals()

  if (loading) return <div className={styles.loading}>Carregando metas...</div>

  return (
    <div className={styles.grid}>
      {quarters.map(q => {
        const st = STATUS[q.status] || STATUS.futuro
        const tProg = q.status === 'andamento' ? timeProgress(q.periodo) : null
        return (
          <div key={q.q} className={`${styles.card}`}>
            <div className={styles.head}>
              <div>
                <span className={styles.qCode}>{q.q}</span>
                <span className={styles.qLabel}>{q.label}</span>
              </div>
              <span className={`${styles.status} ${st.tone}`}>{st.label}</span>
            </div>
            <div className={styles.periodo}>{q.periodo}</div>
            {tProg != null && (
              <div className={styles.timeline}>
                <span className={styles.timelineFill} style={{ width: `${Math.round(tProg * 100)}%` }} />
                <span className={styles.timelineLabel}>{Math.round(tProg * 100)}% do trimestre decorrido</span>
              </div>
            )}

            <div className={styles.metas}>
              {q.metas.map(m => {
                const pct = m.meta > 0 ? Math.round((m.realizado / m.meta) * 100) : 0
                let verdict = null
                if (q.status === 'fechado') {
                  verdict = pct >= 100 ? 'batida' : 'nao-batida'
                } else if (q.status === 'andamento' && tProg != null) {
                  const ratio = pct / 100
                  verdict = ratio >= tProg + 0.05 ? 'adiantado'
                          : ratio <= tProg - 0.08 ? 'atrasado'
                          : 'no-ritmo'
                }
                return (
                  <div key={m.key} className={styles.metaRow}>
                    <div className={styles.metaTop}>
                      <span className={styles.metaLabel}>{m.label}</span>
                      <span className={styles.metaVal}>
                        {q.status === 'futuro'
                          ? <span className={styles.metaTarget}>meta {fmtValue(m.meta, m.unidade)}</span>
                          : <>{fmtValue(m.realizado, m.unidade)} <span className={styles.metaTarget}>/ {fmtValue(m.meta, m.unidade)}</span></>}
                      </span>
                    </div>
                    {q.status !== 'futuro' && (
                      <div className={styles.barTrack}>
                        <span
                          className={`${styles.barFill} ${styles['v_' + (verdict || 'no-ritmo')]}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    )}
                    {verdict && (
                      <span className={`${styles.verdict} ${styles['v_' + verdict]}`}>
                        {verdict === 'batida'     && '✓ meta batida'}
                        {verdict === 'nao-batida' && `△ ${pct}% da meta`}
                        {verdict === 'adiantado'  && `▲ adiantado · ${pct}%`}
                        {verdict === 'no-ritmo'   && `● no ritmo · ${pct}%`}
                        {verdict === 'atrasado'   && `▼ atrasado · ${pct}%`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
