import { useState, useMemo } from 'react'
import { CONTENT_TAGS, CONTENT_DIMENSIONS, dimensionLabel } from '@/features/competitors/hooks/useCompetitors'
import { fmtNumber, fmtPct } from '@/shared/lib/format'
import styles from './ValidatedContent.module.css'

const TYPE_LABEL = { REEL: 'Reel', IMAGE: 'Imagem', CAROUSEL: 'Carrossel', STORY: 'Story' }
const TYPE_COLOR = { REEL: '#8134AF', IMAGE: '#F58529', CAROUSEL: '#F77737', STORY: '#DD2A7B' }

const DIM_ICON = { gancho: '🎯', emocao: '💗', audio: '🎵', ritmo_edicao: '✂️' }

const tagLabel = (key) => CONTENT_TAGS.find(t => t.key === key)?.label || key

export default function ValidatedContent({ competitors, onLogContent, onRemoveContent }) {
  const [filterComp, setFilterComp] = useState('all')
  const [filterTag, setFilterTag]   = useState('all')
  const [sortKey, setSortKey]       = useState('engajamento_taxa')

  const allContent = useMemo(() => {
    const rows = []
    competitors.forEach(c => {
      ;(c.content || []).forEach(ct => {
        rows.push({ ...ct, competitorId: c.id, competitorNome: c.nome, competitorCor: c.cor })
      })
    })
    return rows
  }, [competitors])

  const filtered = useMemo(() => {
    return allContent
      .filter(ct => filterComp === 'all' || ct.competitorId === filterComp)
      .filter(ct => filterTag === 'all' || ct.tag === filterTag)
      .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))
  }, [allContent, filterComp, filterTag, sortKey])

  const dna = useMemo(() => analyzeDNA(allContent), [allContent])

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Conteúdos validados dos concorrentes</h2>
          <p className={styles.sub}>Posts que comprovadamente performaram — a IA extrai o padrão vencedor pra você replicar</p>
        </div>
        {competitors.length > 0 && (
          <div className={styles.logMenu}>
            <span className={styles.logLabel}>Registrar de:</span>
            {competitors.map(c => (
              <button key={c.id} className={styles.logBtn} onClick={() => onLogContent(c)}>
                + {c.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      {allContent.length === 0 ? (
        <div className={styles.empty}>
          Nenhum conteúdo validado ainda. Quando você ver um post de concorrente performando bem,
          registre aqui — a plataforma extrai os padrões pra você replicar.
        </div>
      ) : (
        <>
          {/* DNA do conteúdo vencedor */}
          {dna && (
            <div className={styles.dna}>
              <div className={styles.dnaHead}>
                <span className={styles.dnaIcon}>🧬</span>
                <div>
                  <div className={styles.dnaTitle}>DNA do conteúdo vencedor no seu nicho</div>
                  <div className={styles.dnaSub}>Fórmula extraída de {allContent.length} conteúdos validados, ponderada por engajamento</div>
                </div>
              </div>

              <div className={styles.formula}>
                {dna.formula.map((f, i) => (
                  <div key={f.dim} className={styles.formulaStep}>
                    <div className={styles.formulaCard}>
                      <div className={styles.formulaIcon}>{DIM_ICON[f.dim]}</div>
                      <div className={styles.formulaDimLabel}>{CONTENT_DIMENSIONS[f.dim].label}</div>
                      <div className={styles.formulaValue}>{f.label}</div>
                      <div className={styles.formulaStat}>{fmtPct(f.avgEng, 1)} eng. médio</div>
                    </div>
                    {i < dna.formula.length - 1 && <span className={styles.formulaPlus}>+</span>}
                  </div>
                ))}
              </div>

              <div className={styles.dnaRecipe}>
                💡 <strong>Receita:</strong> {dna.recipe}
              </div>
            </div>
          )}

          {/* Padrões secundários */}
          <div className={styles.patterns}>
            <PatternCard label="Formato dominante" value={dna.topType.label} detail={`${dna.topType.pct}% dos validados`} />
            <PatternCard label="Tema que mais engaja" value={tagLabel(dna.topTag.key)} detail={`${fmtPct(dna.topTag.avgEng, 1)} médio`} />
            <PatternCard label="Engajamento médio" value={fmtPct(dna.avgEng, 1)} detail={`em ${allContent.length} conteúdos`} />
            <PatternCard label="Melhor performance" value={fmtPct(dna.best.engajamento_taxa, 1)} detail={dna.best.competitorNome} />
          </div>

          {/* Filtros */}
          <div className={styles.filters}>
            <select className={styles.select} value={filterComp} onChange={e => setFilterComp(e.target.value)}>
              <option value="all">Todos os concorrentes</option>
              {competitors.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select className={styles.select} value={filterTag} onChange={e => setFilterTag(e.target.value)}>
              <option value="all">Todos os temas</option>
              {CONTENT_TAGS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <select className={styles.select} value={sortKey} onChange={e => setSortKey(e.target.value)}>
              <option value="engajamento_taxa">Maior engajamento</option>
              <option value="curtidas">Mais curtidas</option>
              <option value="comentarios">Mais comentários</option>
            </select>
          </div>

          {/* Lista */}
          {filtered.length === 0 ? (
            <div className={styles.empty}>Nenhum conteúdo nesse filtro.</div>
          ) : (
            <div className={styles.grid}>
              {filtered.map(ct => (
                <div key={ct.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <span className={styles.typeBadge} style={{ background: TYPE_COLOR[ct.tipo] }}>
                      {TYPE_LABEL[ct.tipo]}
                    </span>
                    <span className={styles.compBadge} style={{ '--cor': ct.competitorCor } as React.CSSProperties}>
                      {ct.competitorNome}
                    </span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => onRemoveContent(ct.competitorId, ct.id)}
                      title="Remover"
                    >✕</button>
                  </div>

                  <div className={styles.tema}>{ct.tema}</div>
                  <span className={styles.tag}>{tagLabel(ct.tag)}</span>

                  <div className={styles.metrics}>
                    <span className={styles.engaj}>{fmtPct(ct.engajamento_taxa, 1)}</span>
                    <span className={styles.metric}>♥ {fmtNumber(ct.curtidas)}</span>
                    <span className={styles.metric}>💬 {fmtNumber(ct.comentarios)}</span>
                  </div>

                  {(ct.gancho || ct.emocao || ct.audio || ct.ritmo_edicao) && (
                    <div className={styles.dimensions}>
                      {ct.gancho       && <span className={styles.dimChip}>🎯 {dimensionLabel('gancho', ct.gancho)}</span>}
                      {ct.emocao       && <span className={styles.dimChip}>💗 {dimensionLabel('emocao', ct.emocao)}</span>}
                      {ct.audio        && <span className={styles.dimChip}>🎵 {dimensionLabel('audio', ct.audio)}</span>}
                      {ct.ritmo_edicao && <span className={styles.dimChip}>✂️ {dimensionLabel('ritmo_edicao', ct.ritmo_edicao)}</span>}
                    </div>
                  )}

                  {ct.formato_nota && (
                    <div className={styles.nota}>
                      <strong>Nota:</strong> {ct.formato_nota}
                    </div>
                  )}

                  {ct.permalink && (
                    <a href={ct.permalink} target="_blank" rel="noopener noreferrer" className={styles.link}>
                      Ver post original ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PatternCard({ label, value, detail }) {
  return (
    <div className={styles.patternCard}>
      <div className={styles.patternLabel}>{label}</div>
      <div className={styles.patternValue}>{value}</div>
      <div className={styles.patternDetail}>{detail}</div>
    </div>
  )
}

// === Análise ===

function analyzeDNA(content) {
  if (!content.length) return null

  // Para cada dimensão, encontra o valor com maior engajamento médio
  const DIMS = ['gancho', 'emocao', 'audio', 'ritmo_edicao']
  const formula = DIMS.map(dim => {
    const stats: Record<string, { sum: number; n: number }> = {}
    content.forEach(c => {
      const v = c[dim]
      if (!v) return
      if (!stats[v]) stats[v] = { sum: 0, n: 0 }
      stats[v].sum += c.engajamento_taxa
      stats[v].n += 1
    })
    let best = null
    Object.entries(stats).forEach(([key, s]) => {
      const avg = s.sum / s.n
      if (!best || avg > best.avgEng) best = { key, avgEng: avg, n: s.n }
    })
    if (!best) return { dim, key: null, label: '—', avgEng: 0 }
    return { dim, key: best.key, label: dimensionLabel(dim, best.key), avgEng: best.avgEng }
  }).filter(f => f.key)

  // formato dominante
  const typeCounts = {}
  content.forEach(c => { typeCounts[c.tipo] = (typeCounts[c.tipo] || 0) + 1 })
  const topTypeKey = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a])[0] || 'REEL'
  const topType = {
    label: TYPE_LABEL[topTypeKey] || topTypeKey,
    pct: Math.round((typeCounts[topTypeKey] / content.length) * 100),
  }

  // tema com maior engajamento
  const tagStats: Record<string, { sum: number; n: number }> = {}
  content.forEach(c => {
    if (!tagStats[c.tag]) tagStats[c.tag] = { sum: 0, n: 0 }
    tagStats[c.tag].sum += c.engajamento_taxa
    tagStats[c.tag].n += 1
  })
  let topTag = { key: 'tendencia', avgEng: 0 }
  Object.entries(tagStats).forEach(([key, s]) => {
    const avg = s.sum / s.n
    if (avg > topTag.avgEng) topTag = { key, avgEng: avg }
  })

  const avgEng = content.reduce((s, c) => s + c.engajamento_taxa, 0) / content.length
  const best = [...content].sort((a, b) => b.engajamento_taxa - a.engajamento_taxa)[0]

  const recipe = buildRecipe(formula, topType, topTag)

  return { formula, topType, topTag, avgEng, best, recipe }
}

function buildRecipe(formula, topType, topTag) {
  const get = (dim) => formula.find(f => f.dim === dim)?.label?.toLowerCase() || ''
  const gancho = get('gancho')
  const emocao = get('emocao')
  const audio  = get('audio')
  const ritmo  = get('ritmo_edicao')
  const tag = tagLabel(topTag.key)

  return `Produza um ${topType.label} de "${tag}" que abra com "${gancho}", desperte ${emocao}, use ${audio} e tenha ${ritmo}. Esse é o padrão que mais converte no seu nicho hoje — recrie adaptando ao DNA da sua marca.`
}
