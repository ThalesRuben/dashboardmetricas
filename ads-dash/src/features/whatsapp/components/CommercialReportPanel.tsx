import { useMemo, useState } from 'react'
import {
  useCommercialReport,
  type CommercialReportHorizonte,
  type PlaybookCategoria,
} from '../hooks/useCommercialReport'
import { useWhatsAppMetrics } from '../hooks/useWhatsAppMetrics'
import styles from './CommercialReportPanel.module.css'

export interface CommercialReportPanelProps {
  inboxPhone: string | null
  inboxLabel: string
}

const PRIORIDADE_CLASS = {
  alta:  styles.impItemAlta,
  media: styles.impItemMedia,
  baixa: styles.impItemBaixa,
}

const HORIZONTES: Array<{
  key: CommercialReportHorizonte
  label: string
  dias: number
  descricao: string
}> = [
  { key: 'diario',     label: 'Diário',     dias: 1,  descricao: 'últimas 24h'  },
  { key: 'semanal',    label: 'Semanal',    dias: 7,  descricao: 'últimos 7d'   },
  { key: 'quinzenal',  label: 'Quinzenal',  dias: 15, descricao: 'últimos 15d'  },
  { key: 'mensal',     label: 'Mensal',     dias: 30, descricao: 'últimos 30d'  },
]

const CATEGORIA_LABEL: Record<PlaybookCategoria, string> = {
  velocidade_sla: 'Velocidade & SLA',
  qualificacao:   'Qualificação / discovery',
  follow_up:      'Follow-up & cadência',
  objecoes:       'Objeções & fechamento',
  upsell_cross:   'Upsell / cross-sell',
  reativacao:     'Reativação de perdidos',
  prospeccao:     'Prospecção ativa',
  qualidade:      'Qualidade & treinamento',
}

function periodoFromHorizonte(h: CommercialReportHorizonte): { from: Date; to: Date } {
  const to = new Date()
  to.setHours(23, 59, 59, 999)
  const dias = HORIZONTES.find((x) => x.key === h)?.dias ?? 7
  const from = new Date(to)
  from.setDate(from.getDate() - (dias - 1))
  from.setHours(0, 0, 0, 0)
  return { from, to }
}

export default function CommercialReportPanel({
  inboxPhone, inboxLabel,
}: CommercialReportPanelProps) {
  const [horizonte, setHorizonte] = useState<CommercialReportHorizonte>('semanal')
  const periodo = useMemo(() => periodoFromHorizonte(horizonte), [horizonte])
  // KPIs específicos do horizonte — usa o mesmo repo que o topo da página.
  const { data: metrics, loading: metricsLoading } =
    useWhatsAppMetrics(inboxPhone, periodo)

  const { running, error, result, run, clear } = useCommercialReport()

  const fmtDate = (d: Date) => d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const horizonteMeta = HORIZONTES.find((x) => x.key === horizonte)!
  const subtitle = `${inboxLabel} · ${horizonteMeta.label} (${horizonteMeta.descricao}) · ${fmtDate(periodo.from)} → ${fmtDate(periodo.to)}`

  async function analisar() {
    if (!metrics?.resumo) return
    await run({
      inboxPhone,
      period: periodo,
      horizonte,
      kpis: metrics.resumo,
    })
  }

  function imprimir() {
    window.print()
  }

  function trocarHorizonte(h: CommercialReportHorizonte) {
    if (h === horizonte) return
    setHorizonte(h)
    // limpa o relatório anterior — ele é do horizonte antigo
    clear()
  }

  const podeAnalisar = !running && !metricsLoading && !!metrics?.resumo

  // Playbook agrupado por categoria pra render mais limpo
  const playbookGrupos = useMemo(() => {
    const jogadas = result?.playbook_comercial ?? []
    if (!jogadas.length) return []
    const porCat = new Map<PlaybookCategoria, typeof jogadas>()
    for (const j of jogadas) {
      const arr = porCat.get(j.categoria) || []
      arr.push(j)
      porCat.set(j.categoria, arr)
    }
    // ordena por prioridade dentro de cada grupo
    const ordem: Record<string, number> = { alta: 0, media: 1, baixa: 2 }
    for (const arr of porCat.values()) {
      arr.sort((a, b) => (ordem[a.prioridade] ?? 3) - (ordem[b.prioridade] ?? 3))
    }
    return Array.from(porCat.entries())
  }, [result])

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <h2 className={styles.title}>Relatório comercial — WhatsApp</h2>
          <span className={styles.subtitle}>{subtitle}</span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={analisar}
            disabled={!podeAnalisar}
            title={!metrics?.resumo ? 'Carregando KPIs do horizonte…' : ''}
          >
            {running ? 'Analisando…' : result ? '↻ Reanalisar' : 'Analisar com IA'}
          </button>
          {result && (
            <button type="button" className={styles.btnGhost} onClick={imprimir}>
              Imprimir / Salvar PDF
            </button>
          )}
        </div>
      </header>

      <div className={styles.horizonteTabs} role="tablist" aria-label="Horizonte do relatório">
        {HORIZONTES.map((h) => (
          <button
            key={h.key}
            type="button"
            role="tab"
            aria-selected={h.key === horizonte}
            className={`${styles.horizonteChip} ${h.key === horizonte ? styles.horizonteChipOn : ''}`}
            onClick={() => trocarHorizonte(h.key)}
            disabled={running}
          >
            <span className={styles.horizonteLabel}>{h.label}</span>
            <span className={styles.horizonteHint}>{h.descricao}</span>
          </button>
        ))}
      </div>

      {running && (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          IA lendo as conversas do período ({horizonteMeta.label.toLowerCase()}) e montando
          o playbook comercial… pode levar 30-60s.
        </div>
      )}

      {error && <div className={styles.err}>{error}</div>}

      {!result && !running && !error && (
        <div className={styles.empty}>
          Escolhe o horizonte (<strong>diário</strong>, <strong>semanal</strong>, <strong>quinzenal</strong> ou <strong>mensal</strong>) e
          clica em <span className={styles.cta}>Analisar com IA</span> pra gerar um diagnóstico
          completo do seu comercial: pontos fortes, pontos fracos, metas do horizonte,
          playbook de jogadas (velocidade, qualificação, follow-up, objeções, upsell,
          reativação, prospecção ativa), rituais de gestão, scripts prontos e follow-ups urgentes
          com nome e telefone.
        </div>
      )}

      {result && (
        <div className={styles.report}>
          {result.resumo && <p className={styles.summary}>{result.resumo}</p>}

          {result.diagnostico_executivo && (
            <section>
              <h3 className={styles.sectionTitle}>Diagnóstico executivo</h3>
              <p className={styles.diagnostico}>{result.diagnostico_executivo}</p>
            </section>
          )}

          {!!result.metas_horizonte?.length && (
            <section>
              <h3 className={styles.sectionTitle}>Metas do {horizonteMeta.label.toLowerCase()}</h3>
              <div className={styles.metasGrid}>
                {result.metas_horizonte.map((m, i) => (
                  <div key={i} className={styles.metaCard}>
                    <span className={styles.metaKpi}>{m.kpi}</span>
                    <div className={styles.metaValores}>
                      <span className={styles.metaAtual}>Hoje: {m.atual}</span>
                      <span className={styles.metaAlvo}>→ Meta: {m.meta}</span>
                    </div>
                    <span className={styles.metaGap}>{m.gap}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

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
              <h3 className={styles.sectionTitle}>Ações prioritárias no {horizonteMeta.label.toLowerCase()}</h3>
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

          {!!playbookGrupos.length && (
            <section>
              <h3 className={styles.sectionTitle}>Playbook comercial — jogadas por frente</h3>
              <div className={styles.playbook}>
                {playbookGrupos.map(([cat, jogadas]) => (
                  <div key={cat} className={styles.playbookGroup}>
                    <h4 className={styles.playbookCat}>{CATEGORIA_LABEL[cat] || cat}</h4>
                    <div className={styles.playbookJogadas}>
                      {jogadas.map((j, i) => (
                        <div key={i} className={`${styles.jogada} ${PRIORIDADE_CLASS[j.prioridade] || ''}`}>
                          <div className={styles.jogadaHead}>
                            <span className={styles.jogadaTitle}>{j.jogada}</span>
                            <span className={`${styles.impPriority} ${styles[j.prioridade] || ''}`}>
                              {j.prioridade}
                            </span>
                          </div>
                          <p className={styles.jogadaDesc}>{j.como_executar}</p>
                          <div className={styles.jogadaMeta}>
                            <span><strong>Quando:</strong> {j.quando}</span>
                            <span><strong>Dono:</strong> {j.dono_sugerido}</span>
                            <span><strong>KPI:</strong> {j.kpi_afetado}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!!result.rituais_gestao?.length && (
            <section>
              <h3 className={styles.sectionTitle}>Rituais de gestão do time</h3>
              <div className={styles.rituais}>
                {result.rituais_gestao.map((r, i) => (
                  <div key={i} className={styles.ritual}>
                    <div className={styles.ritualHead}>
                      <span className={styles.ritualNome}>{r.ritual}</span>
                      <span className={styles.ritualFreq}>{r.frequencia} · {r.duracao}</span>
                    </div>
                    <p className={styles.ritualPauta}>{r.pauta}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!!result.scripts_recomendados?.length && (
            <section>
              <h3 className={styles.sectionTitle}>Scripts prontos pra usar</h3>
              <div className={styles.scripts}>
                {result.scripts_recomendados.map((s, i) => (
                  <div key={i} className={styles.script}>
                    <div className={styles.scriptSituacao}>{s.situacao}</div>
                    <pre className={styles.scriptTexto}>{s.script}</pre>
                    {s.observacao && <div className={styles.scriptObs}>💡 {s.observacao}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!!result.follow_ups_imediatos?.length && (
            <section>
              <h3 className={styles.sectionTitle}>Follow-ups pra fazer agora</h3>
              <div className={styles.followups}>
                {result.follow_ups_imediatos.map((f, i) => (
                  <div key={i} className={styles.followup}>
                    <div className={styles.followupHead}>
                      <span className={styles.followupNome}>{f.contato}</span>
                      {f.telefone && <span className={styles.followupTel}>{f.telefone}</span>}
                    </div>
                    <div className={styles.followupMotivo}>{f.motivo}</div>
                    <div className={styles.followupAcao}>→ {f.acao_sugerida}</div>
                    <div className={styles.followupJanela}>Melhor janela: {f.janela_ideal}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className={styles.meta}>
            {result.gerado_em && <>Gerado em {new Date(result.gerado_em).toLocaleString('pt-BR')}</>}
            {result.amostra_contagem && (
              <> · amostra: {result.amostra_contagem.vendas} vendas / {result.amostra_contagem.agendadas} agendadas / {result.amostra_contagem.perdidas} perdidas / {result.amostra_contagem.sla_ruim} SLA ruim</>
            )}
            {result.modelo && <> · modelo {result.modelo}</>}
            {result.horizonte && <> · horizonte {result.horizonte}</>}
          </div>
        </div>
      )}
    </div>
  )
}
