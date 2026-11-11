import { useCommercialReport, type CommercialReportPeriod } from '../hooks/useCommercialReport'
import type { WhatsAppResumo } from '../api/types'
import styles from './CommercialReportPanel.module.css'

export interface CommercialReportPanelProps {
  inboxPhone: string | null
  inboxLabel: string
  period: CommercialReportPeriod
  kpis: WhatsAppResumo
}

const PRIORIDADE_CLASS = {
  alta:  styles.impItemAlta,
  media: styles.impItemMedia,
  baixa: styles.impItemBaixa,
}

export default function CommercialReportPanel({
  inboxPhone, inboxLabel, period, kpis,
}: CommercialReportPanelProps) {
  const { running, error, result, run } = useCommercialReport()

  const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const subtitle = `${inboxLabel} · ${fmtDate(period.from)} → ${fmtDate(period.to)}`

  async function analisar() {
    await run({ inboxPhone, period, kpis })
  }

  function imprimir() {
    window.print()
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <h2 className={styles.title}>Relatório comercial — WhatsApp</h2>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={analisar} disabled={running}>
            {running ? 'Analisando…' : result ? '↻ Reanalisar' : 'Analisar com IA'}
          </button>
          {result && (
            <button type="button" className={styles.btnGhost} onClick={imprimir}>
              Imprimir / Salvar PDF
            </button>
          )}
        </div>
      </header>

      {running && (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          IA lendo as conversas do período e cruzando com os KPIs… pode levar 20-40s.
        </div>
      )}

      {error && <div className={styles.err}>{error}</div>}

      {!result && !running && !error && (
        <div className={styles.empty}>
          Clica em <span className={styles.cta}>Analisar com IA</span> pra gerar um diagnóstico do seu comercial no WhatsApp:
          pontos fortes, pontos de melhoria e ações prioritárias com base numa amostra de vendas, agendamentos,
          conversas perdidas e threads com SLA ruim no período.
        </div>
      )}

      {result && (
        <div className={styles.report}>
          {result.resumo && <p className={styles.summary}>{result.resumo}</p>}

          {!!result.pontos_fortes?.length && (
            <section>
              <h3 className={styles.sectionTitle}>Pontos fortes</h3>
              <ul className={styles.strengths}>
                {result.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </section>
          )}

          {!!result.pontos_melhoria?.length && (
            <section>
              <h3 className={styles.sectionTitle}>Pontos de melhoria</h3>
              <div className={styles.improvements}>
                {result.pontos_melhoria.map((p, i) => (
                  <div key={i} className={`${styles.impItem} ${PRIORIDADE_CLASS[p.prioridade] || ''}`}>
                    <div className={styles.impHead}>
                      <span className={styles.impTitle}>{p.titulo}</span>
                      <span className={`${styles.impPriority} ${styles[p.prioridade] || ''}`}>
                        {p.prioridade}
                      </span>
                    </div>
                    <p className={styles.impDesc}>{p.descricao}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!!result.padroes?.length && (
            <section>
              <h3 className={styles.sectionTitle}>Padrões recorrentes</h3>
              <div className={styles.patterns}>
                {result.padroes.map((pt, i) => (
                  <div key={i} className={styles.pattern}>
                    <div className={styles.patternText}>{pt.padrao}</div>
                    {!!pt.exemplos_resumidos?.length && (
                      <ul className={styles.patternExamples}>
                        {pt.exemplos_resumidos.map((ex, j) => <li key={j}>{ex}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!!result.acoes_prioritarias?.length && (
            <section>
              <h3 className={styles.sectionTitle}>Ações prioritárias essa semana</h3>
              <ol className={styles.actionsList}>
                {result.acoes_prioritarias.map((a, i) => (
                  <li key={i} className={styles.actionItem}>
                    <div className={styles.actionBody}>
                      <span className={styles.actionText}>{a.acao}</span>
                      <span className={styles.actionImpact}>Impacto esperado: {a.impacto_esperado}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className={styles.meta}>
            {result.gerado_em && <>Gerado em {new Date(result.gerado_em).toLocaleString('pt-BR')}</>}
            {result.amostra_contagem && (
              <> · amostra: {result.amostra_contagem.vendas} vendas / {result.amostra_contagem.agendadas} agendadas / {result.amostra_contagem.perdidas} perdidas / {result.amostra_contagem.sla_ruim} SLA ruim</>
            )}
            {result.modelo && <> · modelo {result.modelo}</>}
          </div>
        </div>
      )}
    </div>
  )
}
