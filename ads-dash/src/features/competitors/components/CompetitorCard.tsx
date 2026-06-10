import { latestSnapshot } from '@/features/competitors/hooks/useCompetitors'
import { fmtNumber, fmtPct } from '@/shared/lib/format'
import styles from './CompetitorCard.module.css'

export default function CompetitorCard({ competitor, you, onSnapshot, onContent, onRemove }) {
  const snap = latestSnapshot(competitor)
  const initial = (competitor.nome || '?').charAt(0).toUpperCase()
  const contentCount = (competitor.content || []).length

  // comparação rápida vs você
  const diffFollowers = (you && snap) ? snap.seguidores - you.seguidores : null
  const aheadOfYou = diffFollowers != null && diffFollowers > 0

  return (
    <div className={styles.card} style={{ '--accent': competitor.cor } as React.CSSProperties}>
      <div className={styles.head}>
        <div className={styles.avatar} style={{ background: competitor.cor }}>{initial}</div>
        <div className={styles.identity}>
          <div className={styles.nome}>{competitor.nome}</div>
          <div className={styles.handle}>{competitor.handle || competitor.segmento || '—'}</div>
        </div>
        <button className={styles.removeBtn} onClick={() => onRemove(competitor.id)} title="Remover">✕</button>
      </div>

      {snap ? (
        <>
          <div className={styles.metrics}>
            <Metric
              label="Seguidores"
              value={fmtNumber(snap.seguidores)}
              delta={snap.seguidores_delta > 0 ? `+${fmtNumber(snap.seguidores_delta)}` : fmtNumber(snap.seguidores_delta)}
              up={snap.seguidores_delta > 0}
            />
            <Metric label="Engajamento" value={fmtPct(snap.engajamento_taxa, 1)} />
            <Metric label="Posts/sem" value={String(snap.posts_semana)} />
            <Metric label="Total posts" value={fmtNumber(snap.total_posts)} />
          </div>

          {(snap.seguidores_tiktok > 0 || snap.seguidores_youtube > 0 || snap.seguidores_facebook > 0) && (
            <div className={styles.networks}>
              {snap.seguidores_tiktok > 0   && <span className={styles.netChip}>TikTok {fmtNumber(snap.seguidores_tiktok)}</span>}
              {snap.seguidores_youtube > 0  && <span className={styles.netChip}>YouTube {fmtNumber(snap.seguidores_youtube)}</span>}
              {snap.seguidores_facebook > 0 && <span className={styles.netChip}>Facebook {fmtNumber(snap.seguidores_facebook)}</span>}
            </div>
          )}

          {snap.reclame_aqui_nota > 0 && (
            <div className={`${styles.reputacao} ${reputacaoClass(snap.reclame_aqui_nota)}`}>
              <span className={styles.repIcon}>★</span>
              Reclame Aqui: <strong>{snap.reclame_aqui_nota.toFixed(1)}</strong>/10
              <span className={styles.repDetail}>
                · {fmtNumber(snap.reclame_aqui_reclamacoes)} reclam. · {snap.reclame_aqui_resolvidas_pct}% resolvidas
              </span>
            </div>
          )}

          {you && (
            <div className={`${styles.vsYou} ${aheadOfYou ? styles.vsAhead : styles.vsBehind}`}>
              {aheadOfYou
                ? `${fmtNumber(Math.abs(diffFollowers))} seguidores à sua frente`
                : `${fmtNumber(Math.abs(diffFollowers))} seguidores atrás de você`}
            </div>
          )}
        </>
      ) : (
        <div className={styles.noData}>Sem snapshots ainda — registre o primeiro.</div>
      )}

      <div className={styles.actions}>
        <button className={styles.snapshotBtn} onClick={() => onSnapshot(competitor)}>
          + Snapshot
        </button>
        <button className={styles.contentBtn} onClick={() => onContent(competitor)}>
          + Conteúdo {contentCount > 0 && <span className={styles.contentCount}>{contentCount}</span>}
        </button>
      </div>
    </div>
  )
}

function reputacaoClass(nota) {
  if (nota >= 8)  return styles.repGood
  if (nota >= 6)  return styles.repMid
  return styles.repBad
}

function Metric({ label, value, delta = null, up = false }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricLabel}>{label}</div>
      {delta && (
        <div className={`${styles.metricDelta} ${up ? styles.deltaUp : styles.deltaDown}`}>
          {up ? '▲' : '▼'} {delta}
        </div>
      )}
    </div>
  )
}
