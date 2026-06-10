import styles from './FunnelBar.module.css'

export default function FunnelBar({ funil }) {
  const steps = [
    { label: 'Impressões',    value: funil.impressoes },
    { label: 'Cliques',       value: funil.cliques },
    { label: 'Mensagens',     value: funil.mensagens },
    { label: 'Agendamentos',  value: funil.agendamentos },
    { label: 'Vendas',        value: funil.vendas },
  ]
  const base = steps[0].value

  return (
    <div className={styles.card}>
      <div className={styles.row}>
        {steps.map((s, i) => (
          <div key={s.label} className={styles.step}>
            <div className={styles.val}>{s.value.toLocaleString('pt-BR')}</div>
            <div className={styles.lbl}>{s.label}</div>
            {i > 0 && (
              <div className={styles.pct}>
                {((s.value / steps[i - 1].value) * 100).toFixed(0)}%
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={styles.bars}>
        {steps.map(s => (
          <div key={s.label} className={styles.barWrap}>
            <div
              className={styles.bar}
              style={{ width: `${Math.max(4, (s.value / base) * 100)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
