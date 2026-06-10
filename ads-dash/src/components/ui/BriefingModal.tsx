import { useEffect } from 'react'
import { buildBriefing } from '@/lib/narrativeBriefing'
import { computeHealth } from '@/lib/healthScore'
import { detectAnomalies } from '@/lib/anomalies'
import { fmtBRL, fmtNumber, fmtRoas, fmtPct } from '@/shared/lib/format'
import styles from './BriefingModal.module.css'

// Briefing "1 página pra reunião" — renderiza a página em layout printable.
// O botão "Imprimir / salvar PDF" usa window.print() — o navegador pode salvar como PDF.
export default function BriefingModal({ onClose, summary, prev, ig, wa, days }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.classList.add('briefingOpen')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('briefingOpen')
    }
  }, [onClose])

  const b = buildBriefing(summary, prev, ig)
  const h = computeHealth({ summary, prev, ig, whatsapp: wa })
  const anomalies = detectAnomalies(days)
  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className={styles.overlay}>
      <div className={styles.bar}>
        <span className={styles.barTitle}>Briefing de reunião · pronto pra imprimir</span>
        <div className={styles.barBtns}>
          <button className="cc-btn cc-btn--solid" onClick={() => window.print()}>
            ▸ Imprimir / Salvar PDF
          </button>
          <button className="cc-btn" onClick={onClose}>Fechar</button>
        </div>
      </div>

      <div className={styles.page}>
        <header className={styles.pageHead}>
          <div>
            <div className={styles.kicker}>BRIEFING SEMANAL · OPERAÇÃO</div>
            <h1 className={styles.pageTitle}>The Blonde Concept</h1>
          </div>
          <div className={styles.pageDate}>
            <span>{dateStr}</span>
            <span className={styles.healthBadge}>
              Health Score: <strong>{h.total}/100</strong> · {h.verdict.label}
            </span>
          </div>
        </header>

        <section className={styles.block}>
          <h2 className={styles.h2}>Resumo</h2>
          <p className={styles.paragrafo}>{b.paragrafo}</p>
        </section>

        <section className={styles.kpis}>
          {[
            { k: 'ROAS',         v: fmtRoas(summary?.roas || 0) },
            { k: 'ROI',          v: `${summary?.roi || 0}%` },
            { k: 'Investido',    v: fmtBRL(summary?.investido || 0) },
            { k: 'Receita',      v: fmtBRL(summary?.receita || 0) },
            { k: 'Mensagens',    v: fmtNumber(summary?.mensagens || 0) },
            { k: 'Agendamentos', v: fmtNumber(summary?.agendamentos || 0) },
            { k: 'Vendas',       v: fmtNumber(summary?.vendas || 0) },
            { k: 'CTR médio',    v: fmtPct(summary?.ctr || 0, 2) },
          ].map(it => (
            <div key={it.k} className={styles.kpi}>
              <span className={styles.kpiLabel}>{it.k}</span>
              <span className={styles.kpiValue}>{it.v}</span>
            </div>
          ))}
        </section>

        <div className={styles.two}>
          <section className={styles.block}>
            <h2 className={styles.h2}>Próxima ação</h2>
            <p className={styles.acao}>{b.proximaAcao}</p>
          </section>

          <section className={styles.block}>
            <h2 className={styles.h2}>Saúde por dimensão</h2>
            <ul className={styles.dims}>
              {h.dims.map(d => (
                <li key={d.key}>
                  <span className={styles.dimLabel}>{d.label}</span>
                  <span className={styles.dimScore}>{d.score}/100</span>
                  <span className={styles.dimNote}>{d.txt}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {anomalies.length > 0 && (
          <section className={styles.block}>
            <h2 className={styles.h2}>Anomalias da semana</h2>
            <ul className={styles.anomalies}>
              {anomalies.map(a => (
                <li key={a.key}>
                  <strong>{a.label}</strong> — {a.mensagem.toLowerCase()}.
                </li>
              ))}
            </ul>
          </section>
        )}

        {b.destaques.length > 0 && (
          <section className={styles.block}>
            <h2 className={styles.h2}>Movimentos do período</h2>
            <ul className={styles.movers}>
              {b.destaques.map(d => (
                <li key={d.key}>
                  {d.tone === 'up' ? '▲' : '▼'} <strong>{d.label}</strong> {d.delta >= 0 ? '+' : ''}{d.delta}%
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className={styles.pageFoot}>
          Gerado pelo Backoffice The Blonde Concept · {dateStr}
        </footer>
      </div>
    </div>
  )
}
