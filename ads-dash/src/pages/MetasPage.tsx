import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  useMetas,
  progressoTempo,
  diasRestantes,
  rotuloPeriodo,
  veredito,
  trimestreRef as currentTrimestreRef,
  anoRef as currentAnoRef,
  type MetaPeriodo,
  type MetaKpi,
  type Veredito,
} from '@/features/metas'
import MetasTrimestreView from '@/features/metas/components/MetasTrimestreView'
import MetasAnoView from '@/features/metas/components/MetasAnoView'
import { fmtNumber, fmtBRL, fmtRoas, fmtPct } from '@/shared/lib/format'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import styles from './MetasPage.module.css'

const TABS: { id: MetaPeriodo; label: string }[] = [
  { id: 'semana',    label: 'Semana' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'ano',       label: 'Ano' },
]

const VEREDITO_LABEL: Record<Veredito, { tone: string; text: string }> = {
  'batida':    { tone: 'success', text: '✓ meta batida' },
  'adiantado': { tone: 'success', text: '▲ adiantado' },
  'no-ritmo':  { tone: 'info',    text: '● no ritmo' },
  'atrasado':  { tone: 'warning', text: '▼ atrasado' },
  'sem-meta':  { tone: 'subtle',  text: 'sem meta' },
}

export default function MetasPage() {
  const [periodo, setPeriodo] = useState<MetaPeriodo>('trimestre')
  const [trimestreSelecionado, setTrimestreSelecionado] = useState<string>(() => currentTrimestreRef())

  function handleAbrirTrimestre(qRef: string) {
    setTrimestreSelecionado(qRef)
    setPeriodo('trimestre')
  }

  return (
    <div className={styles.page}>
      <PageHeader
        section="metas"
        title="Metas"
        subtitle="Cenários mín / base / máx por trimestre, com quebra mensal de faturamento e tráfego."
        actions={
          <Link to="/settings#metas" className="btn">⚙ Configurar metas</Link>
        }
      />

      <Tabs items={TABS} activeId={periodo} onChange={(id) => setPeriodo(id as MetaPeriodo)} accentColor="var(--section-metas)" />

      {periodo === 'semana' && <SemanaView />}
      {periodo === 'trimestre' && (
        <TrimestreContexto
          trimestreRef={trimestreSelecionado}
          onAlterarRef={setTrimestreSelecionado}
        />
      )}
      {periodo === 'ano' && (
        <MetasAnoView anoRef={currentAnoRef()} onAbrirTrimestre={handleAbrirTrimestre} />
      )}
    </div>
  )
}

// ---------- Trimestre (header com selector + view rica) ----------

function TrimestreContexto({ trimestreRef, onAlterarRef }: { trimestreRef: string; onAlterarRef: (r: string) => void }) {
  const ano = currentAnoRef()
  const qs = [1, 2, 3, 4].map(q => `${ano}-Q${q}`)
  return (
    <>
      <section className={styles.qSelector}>
        {qs.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => onAlterarRef(r)}
            className={`${styles.qBtn} ${r === trimestreRef ? styles.qBtnActive : ''}`}
          >
            {r.split('-Q')[1]}º trim
          </button>
        ))}
      </section>
      <MetasTrimestreView trimestreRef={trimestreRef} />
    </>
  )
}

// ---------- Semana (visão original, mantida) ----------

function SemanaView() {
  const periodo: MetaPeriodo = 'semana'
  const { metas, loading, periodoRef } = useMetas({ periodo })
  const tempoFracao = useMemo(() => progressoTempo(periodo), [periodo])
  const restante = useMemo(() => diasRestantes(periodo), [periodo])
  const resumo = useMemo(() => calcularResumo(metas, tempoFracao), [metas, tempoFracao])

  return (
    <>
      <section className={styles.contextBar}>
        <div className={styles.contextLeft}>
          <span className={styles.contextLabel}>{rotuloPeriodo(periodo, periodoRef)}</span>
          <span className={styles.contextSub}>
            {Math.round(tempoFracao * 100)}% do período decorrido · faltam {restante} dia{restante === 1 ? '' : 's'}
          </span>
        </div>
        <div className={styles.contextResumo}>
          <span className={styles.resumoCount} data-tone="success">{resumo.adiantado + resumo.batida}</span>
          <span className={styles.resumoLabel}>no caminho</span>
          <span className={styles.resumoSep}>·</span>
          <span className={styles.resumoCount} data-tone="warning">{resumo.atrasado}</span>
          <span className={styles.resumoLabel}>atrasada{resumo.atrasado === 1 ? '' : 's'}</span>
          <span className={styles.resumoSep}>·</span>
          <span className={styles.resumoCount} data-tone="subtle">{resumo.semMeta}</span>
          <span className={styles.resumoLabel}>sem meta</span>
        </div>
      </section>

      {loading ? (
        <p className={styles.loading}>Carregando metas...</p>
      ) : (
        <section className={styles.grid}>
          {metas.map((m) => (
            <MetaCard key={m.kpi} meta={m} tempoFracao={tempoFracao} />
          ))}
        </section>
      )}
    </>
  )
}

interface ResumoVeredito { batida: number; adiantado: number; noRitmo: number; atrasado: number; semMeta: number }

function calcularResumo(metas: MetaKpi[], tempo: number): ResumoVeredito {
  const acc: ResumoVeredito = { batida: 0, adiantado: 0, noRitmo: 0, atrasado: 0, semMeta: 0 }
  for (const m of metas) {
    const pct = m.valor_meta > 0 ? (m.valor_realizado / m.valor_meta) * 100 : 0
    const v = veredito(pct, tempo, m.valor_meta)
    if (v === 'batida')    acc.batida++
    if (v === 'adiantado') acc.adiantado++
    if (v === 'no-ritmo')  acc.noRitmo++
    if (v === 'atrasado')  acc.atrasado++
    if (v === 'sem-meta')  acc.semMeta++
  }
  return acc
}

function fmtUnidade(valor: number, unidade: MetaKpi['unidade']): string {
  if (unidade === 'BRL') return fmtBRL(valor)
  if (unidade === 'x')   return fmtRoas(valor)
  if (unidade === '%')   return fmtPct(valor)
  return fmtNumber(valor)
}

function MetaCard({ meta, tempoFracao }: { meta: MetaKpi; tempoFracao: number }) {
  const pct = meta.valor_meta > 0 ? Math.round((meta.valor_realizado / meta.valor_meta) * 100) : 0
  const v = veredito(pct, tempoFracao, meta.valor_meta)
  const verdInfo = VEREDITO_LABEL[v]
  const semMeta = v === 'sem-meta'

  return (
    <article className={`${styles.card} ${semMeta ? styles.cardEmpty : ''}`}>
      <header className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{meta.label || meta.kpi}</h3>
        <span className={`${styles.verd} ${styles[`verd_${verdInfo.tone}`]}`}>{verdInfo.text}</span>
      </header>

      {semMeta ? (
        <p className={styles.cardEmptyText}>
          Sem meta definida.
          <br />
          <Link to="/settings#metas" className={styles.cardEmptyLink}>Configurar</Link>
        </p>
      ) : (
        <>
          <div className={styles.cardValores}>
            <span className={styles.cardAtual}>{fmtUnidade(meta.valor_realizado, meta.unidade)}</span>
            <span className={styles.cardSep}>/</span>
            <span className={styles.cardMeta}>{fmtUnidade(meta.valor_meta, meta.unidade)}</span>
          </div>

          <div className={styles.barTrack}>
            <span
              className={`${styles.barFill} ${styles[`bar_${verdInfo.tone}`]}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
            <span className={styles.barTime} style={{ left: `${Math.round(tempoFracao * 100)}%` }} title="Progresso do tempo" />
          </div>

          <footer className={styles.cardFoot}>
            <span className={styles.cardPct}>{pct}% da meta</span>
            <span className={styles.cardTimeSub}>{Math.round(tempoFracao * 100)}% do tempo</span>
          </footer>
        </>
      )}
    </article>
  )
}

