import { useEffect } from 'react'
import Sparkline from './Sparkline'
import styles from './MetricExplainer.module.css'

// Drawer que explica "por que essa métrica" e mostra o que está por trás
// do número. Estilo Stripe (explicador) + Mixpanel (drill-down).
export default function MetricExplainer({ metric, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!metric) return null
  const m = metric
  const deltaSign = m.delta == null ? null : m.delta > 0 ? '▲' : m.delta < 0 ? '▼' : '·'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside className={`${styles.drawer} cc-frame`} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <div>
            <span className={styles.tag}>MÉTRICA · EXPLICADOR</span>
            <h2 className={styles.title}>{m.label}</h2>
          </div>
          <button className={styles.close} onClick={onClose} title="Fechar (Esc)">×</button>
        </div>

        <div className={styles.valueRow}>
          <span className={styles.value}>{m.valor}</span>
          {m.delta != null && (
            <span className={`${styles.delta} ${m.delta >= 0 ? styles.up : styles.down}`}>
              {deltaSign} {Math.abs(m.delta).toFixed(1)}% vs período anterior ({m.valorAnterior})
            </span>
          )}
        </div>

        {m.serie && m.serie.length > 1 && (
          <div className={styles.spark}>
            <Sparkline serie={m.serie} color="var(--accent)" width={520} height={70} />
          </div>
        )}

        <Section title="O que é">
          <p className={styles.txt}>{m.definicao}</p>
        </Section>

        <Section title="Como é calculado">
          <code className={styles.code}>{m.formula}</code>
        </Section>

        {m.meta != null && (
          <Section title="Meta">
            <div className={styles.meta}>
              <span className={m.aboveTarget ? styles.metaOk : styles.metaBelow}>
                {m.aboveTarget ? '✓ Acima da meta' : '△ Abaixo da meta'}
              </span>
              <span className={styles.metaLabel}>{m.metaLabel}</span>
            </div>
          </Section>
        )}

        <Section title="O que está puxando agora">
          <div className={styles.drivers}>
            {m.drivers.map((d, i) => (
              <div key={i} className={styles.driver}>
                <span className={styles.driverLabel}>{d.label}</span>
                <span className={styles.driverValue}>{d.value}</span>
              </div>
            ))}
          </div>
        </Section>

        {m.drillItems && m.drillItems.length > 0 && (
          <Section title={`Ver os ${m.drillItems.length} itens por trás do número`}>
            <div className={styles.drill}>
              {m.drillItems.map((it, i) => (
                <div key={i} className={styles.drillItem}>
                  <div>
                    <span className={styles.drillTitle}>{it.titulo}</span>
                    <span className={styles.drillSub}>{it.sub}</span>
                  </div>
                  <span className={styles.drillTag}>{it.tag}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </aside>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  )
}
