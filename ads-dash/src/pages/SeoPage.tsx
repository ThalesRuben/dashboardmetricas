import { useSeoAgent, KeywordResearch } from '@/features/seo'
import KpiCard from '@/shared/ui/KpiCard'
import PageHeader from '@/components/ui/PageHeader'
import { fmtNumber, fmtDelta } from '@/shared/lib/format'
import styles from './SeoPage.module.css'

const PRIORITY = {
  alta:  styles.prAlta,
  média: styles.prMedia,
  media: styles.prMedia,
  baixa: styles.prBaixa,
}
const AUDIT = {
  ok:     { icon: '✓', tone: styles.auOk },
  alerta: { icon: '!', tone: styles.auWarn },
  erro:   { icon: '✕', tone: styles.auErr },
}

export default function SeoPage() {
  const { data, loading, usingMock, refresh } = useSeoAgent()

  if (loading || !data) {
    return <div className={styles.page}><div className={styles.loading}>Carregando dados de SEO...</div></div>
  }

  const r = data.resumo

  return (
    <div className={styles.page}>
      <PageHeader
        section="seo"
        title="Agente de SEO"
        subtitle={`SEO Score ${data.score}/100 · ${data.resumo.no_top10} no top 10 · ${data.resumo.trafego_organico_mes.toLocaleString('pt-BR')} visitas/mês`}
      />

      {usingMock && (
        <div className={styles.mockBanner}>
          ⓘ Dados de demonstração. Conecte o Google Search Console em <strong>Integrações</strong> para
          puxar posições e tráfego reais.
        </div>
      )}

      <section className={styles.topRow}>
        <div className={`${styles.scoreCard}`}>
          <span className={styles.scoreLabel}>SEO Score</span>
          <div className={styles.scoreVal}>
            <span className={styles.scoreNum}>{data.score}</span>
            <span className={styles.scoreMax}>/100</span>
          </div>
          <span className={styles.scoreDelta}>▲ {fmtDelta(data.score_delta, ' pts')} no mês</span>
          <div className={styles.scoreTrack}>
            <span className={styles.scoreFill} style={{ width: `${data.score}%` }} />
          </div>
        </div>
        <div className={styles.kpiGrid}>
          <KpiCard label="Keywords monitoradas" value={fmtNumber(r.keywords_monitoradas)} neutral />
          <KpiCard label="No top 10" value={fmtNumber(r.no_top10)} neutral />
          <KpiCard
            label="Tráfego orgânico / mês"
            value={fmtNumber(r.trafego_organico_mes)}
            delta={`${fmtDelta(r.trafego_delta)} vs mês ant.`}
            up
          />
        </div>
      </section>

      <KeywordResearch onAdded={refresh} />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Palavras-chave monitoradas</h2>
        <div className={`${styles.card}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Termo</th><th>Posição</th><th>Volume/mês</th><th>Dificuldade</th><th>Oportunidade</th>
              </tr>
            </thead>
            <tbody>
              {data.keywords.map(k => {
                const move = k.posicao_anterior - k.posicao
                return (
                  <tr key={k.termo}>
                    <td className={styles.termo}>{k.termo}</td>
                    <td>
                      <span className={styles.pos}>{k.posicao}º</span>
                      {move !== 0 && (
                        <span className={move > 0 ? styles.posUp : styles.posDown}>
                          {move > 0 ? `▲${move}` : `▼${Math.abs(move)}`}
                        </span>
                      )}
                    </td>
                    <td className={styles.mono}>{fmtNumber(k.volume)}</td>
                    <td><span className={styles.chip}>{k.dificuldade}</span></td>
                    <td><span className={`${styles.chip} ${k.oportunidade === 'alta' ? styles.chipHot : ''}`}>{k.oportunidade}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.split}>
        <div>
          <h2 className={styles.sectionTitle}>Sugestões do agente</h2>
          <div className={styles.suggestions}>
            {data.sugestoes.map((s, i) => (
              <div key={i} className={`${styles.sug}`}>
                <div className={styles.sugHead}>
                  <span className={`${styles.priority} ${PRIORITY[s.prioridade] || styles.prMedia}`}>
                    {s.prioridade}
                  </span>
                  <span className={styles.sugTipo}>{s.tipo}</span>
                </div>
                <h3 className={styles.sugTitle}>{s.titulo}</h3>
                <p className={styles.sugDesc}>{s.descricao}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className={styles.sectionTitle}>Auditoria on-page</h2>
          <div className={`${styles.card}`}>
            {data.auditoria.map((a, i) => {
              const au = AUDIT[a.status] || AUDIT.alerta
              return (
                <div key={i} className={styles.auditRow}>
                  <span className={`${styles.auditIcon} ${au.tone}`}>{au.icon}</span>
                  <div>
                    <span className={styles.auditItem}>{a.item}</span>
                    <span className={styles.auditNota}>{a.nota}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
