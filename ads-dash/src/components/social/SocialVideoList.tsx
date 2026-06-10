import { useState } from 'react'
import { fmtNumber, fmtTimeAgo } from '@/shared/lib/format'
import styles from './SocialVideoList.module.css'

// Lista genérica de vídeos/conteúdos para qualquer rede social.
// videos: array de objetos
// titleField: campo usado como título (ex: 'caption' ou 'titulo')
// metrics: [{ key, label, icon, fmt }] — colunas de métrica a exibir
// accent: cor da rede
export default function SocialVideoList({ videos, titleField = 'caption', metrics, accent = '#185FA5' }) {
  const sortable = metrics.filter(m => m.sortable !== false)
  const [sortKey, setSortKey] = useState(sortable[0]?.key || metrics[0]?.key)

  const list = [...videos].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.sortLabel}>Ordenar por:</span>
        <select className={styles.sortSelect} value={sortKey} onChange={e => setSortKey(e.target.value)}>
          {sortable.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>

      {list.length === 0 ? (
        <div className={styles.empty}>Nenhum conteúdo registrado ainda.</div>
      ) : (
        <div className={styles.list}>
          {list.map((v, i) => (
            <div key={v.id || i} className={styles.row}>
              <div className={styles.rank} style={{ background: accent }}>{i + 1}</div>
              <div className={styles.thumb} style={{ '--accent': accent } as React.CSSProperties}>
                {v.thumbnail_url
                  ? <img src={v.thumbnail_url} alt="" />
                  : <span className={styles.thumbIcon}>▶</span>}
              </div>
              <div className={styles.body}>
                <p className={styles.title}>{v[titleField] || 'Sem título'}</p>
                <span className={styles.date}>{fmtTimeAgo(v.publicado_em)}</span>
              </div>
              <div className={styles.metrics}>
                {metrics.map(m => (
                  <div key={m.key} className={styles.metric}>
                    <div className={styles.metricVal}>
                      {m.fmt ? m.fmt(v[m.key]) : fmtNumber(v[m.key])}
                    </div>
                    <div className={styles.metricLbl}>{m.icon} {m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
