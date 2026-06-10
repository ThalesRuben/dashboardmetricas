import { useState } from 'react'
import { useAmbassadors, AMBASSADOR_TYPES, AMBASSADOR_STATUS } from '@/features/ambassadors'
import { useAiBrain } from '@/features/ai'
import { useToast } from '@/app/providers/ToastContext'
import { analyzeHandles, scoutInfluencers } from '@/lib/influencerScout'
import KpiCard from '@/shared/ui/KpiCard'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import BibleBadge from '@/components/ui/BibleBadge'
import { fmtNumber, fmtCompact, fmtBRL, fmtPct } from '@/shared/lib/format'
import styles from './AmbassadorsPage.module.css'

const typeLabel = k => AMBASSADOR_TYPES.find(t => t.key === k)?.label || k
const statusInfo = k => AMBASSADOR_STATUS.find(s => s.key === k) || AMBASSADOR_STATUS[2]

const EMPTY = { nome: '', handle: '', plataforma: 'Instagram', tipo: 'micro', seguidores: '', engajamento: '', cupom: '', comissao_pct: '', status: 'negociando' }

export default function AmbassadorsPage() {
  const { ambassadors, loading, usingLocal, addAmbassador, removeAmbassador } = useAmbassadors()
  const { brain } = useAiBrain()
  const [tab, setTab] = useState('parceiros')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const toast = useToast()

  if (loading) {
    return <div className={styles.page}><div className={styles.loading}>Carregando embaixadores...</div></div>
  }

  const ativos = ambassadors.filter(a => a.status === 'ativo')
  const receitaTotal = ambassadors.reduce((s, a) => s + (a.receita_atribuida || 0), 0)
  const vendasTotal  = ambassadors.reduce((s, a) => s + (a.vendas_atribuidas || 0), 0)
  const alcanceTotal = ambassadors.reduce((s, a) => s + (a.seguidores || 0), 0)

  async function handleAdd() {
    if (!form.nome || !form.handle) { toast.error('Informe nome e @ do parceiro.'); return }
    const { error } = await addAmbassador(form as never)
    if (error) { toast.error('Erro ao adicionar.'); return }
    toast.success('Parceiro adicionado.')
    setForm(EMPTY); setShowAdd(false)
  }

  async function handleInvite(c) {
    const { error } = await addAmbassador({
      nome: c.nome, handle: c.handle, plataforma: c.plataforma,
      tipo: c.tier === 'micro' ? 'micro' : 'influenciador',
      seguidores: c.seguidores, engajamento: c.engajamento, status: 'negociando',
    })
    if (error) { toast.error('Erro ao adicionar.'); return }
    toast.success(`${c.nome} entrou na lista em negociação.`)
  }

  const tabs = [
    { id: 'parceiros', label: 'Meus parceiros', badge: ambassadors.length || undefined },
    { id: 'scout',     label: '✦ Scout de IA' },
  ]

  return (
    <div className={styles.page}>
      <PageHeader
        section="ambassadors"
        title="Embaixadores e influenciadores"
        subtitle="Parceiros da marca — alcance, cupons e recomendação por IA"
        actions={
          tab === 'parceiros' ? (
            <button className="btn btn--primary" onClick={() => setShowAdd(s => !s)}>
              {showAdd ? 'Cancelar' : '+ Novo parceiro'}
            </button>
          ) : null
        }
      />

      <Tabs items={tabs} activeId={tab} onChange={setTab} accentColor="var(--section-ambassadors)" />

      {tab === 'parceiros' && (
        <>
          {usingLocal && (
            <div className={styles.localBanner}>ⓘ Modo local — os parceiros ficam salvos só neste navegador.</div>
          )}

          {showAdd && (
            <div className={`${styles.card} ${styles.addForm}`}>
              <div className={styles.formGrid}>
                <Field label="Nome"><input className={styles.input} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></Field>
                <Field label="@ / handle"><input className={styles.input} value={form.handle} onChange={e => setForm(f => ({ ...f, handle: e.target.value }))} /></Field>
                <Field label="Plataforma">
                  <select className={styles.input} value={form.plataforma} onChange={e => setForm(f => ({ ...f, plataforma: e.target.value }))}>
                    {['Instagram', 'TikTok', 'YouTube'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Tipo">
                  <select className={styles.input} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    {AMBASSADOR_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Seguidores"><input className={styles.input} type="number" value={form.seguidores} onChange={e => setForm(f => ({ ...f, seguidores: e.target.value }))} /></Field>
                <Field label="Engajamento (%)"><input className={styles.input} type="number" value={form.engajamento} onChange={e => setForm(f => ({ ...f, engajamento: e.target.value }))} /></Field>
                <Field label="Cupom"><input className={styles.input} value={form.cupom} onChange={e => setForm(f => ({ ...f, cupom: e.target.value }))} /></Field>
                <Field label="Comissão (%)"><input className={styles.input} type="number" value={form.comissao_pct} onChange={e => setForm(f => ({ ...f, comissao_pct: e.target.value }))} /></Field>
                <Field label="Status">
                  <select className={styles.input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {AMBASSADOR_STATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </Field>
              </div>
              <button className="btn btn--primary" onClick={handleAdd}>Salvar parceiro</button>
            </div>
          )}

          <section className={styles.kpiGrid}>
            <KpiCard label="Parceiros" value={fmtNumber(ambassadors.length)} neutral />
            <KpiCard label="Ativos" value={fmtNumber(ativos.length)} neutral />
            <KpiCard label="Alcance somado" value={fmtCompact(alcanceTotal)} neutral />
            <KpiCard label="Vendas atribuídas" value={fmtNumber(vendasTotal)} neutral />
            <KpiCard label="Receita atribuída" value={fmtBRL(receitaTotal)} neutral accentColor="var(--section-ambassadors)" />
          </section>

          <div className={styles.cardGrid}>
            {ambassadors.map(a => {
              const st = statusInfo(a.status)
              return (
                <div key={a.id} className={styles.amb}>
                  <div className={styles.ambHead}>
                    <div className={styles.avatar}>{a.nome.slice(0, 1)}</div>
                    <div className={styles.ambId}>
                      <span className={styles.ambNome}>{a.nome}</span>
                      <span className={styles.ambHandle}>{a.handle} · {a.plataforma}</span>
                    </div>
                    <button className={styles.del} onClick={() => removeAmbassador(a.id)} title="Remover">✕</button>
                  </div>
                  <div className={styles.tags}>
                    <span className={styles.tagType}>{typeLabel(a.tipo)}</span>
                    <span className={`${styles.tagStatus} ${styles['s_' + st.tone]}`}>{st.label}</span>
                    {a.cupom && <span className={styles.tagCupom}>{a.cupom}</span>}
                  </div>
                  <div className={styles.stats}>
                    <Stat label="Seguidores" value={fmtCompact(a.seguidores)} />
                    <Stat label="Engaj." value={fmtPct(a.engajamento)} />
                    <Stat label="Cliques" value={fmtNumber(a.cliques)} />
                    <Stat label="Vendas" value={fmtNumber(a.vendas_atribuidas)} />
                    <Stat label="Receita" value={fmtBRL(a.receita_atribuida)} accent />
                    <Stat label="Comissão" value={fmtPct(a.comissao_pct)} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'scout' && (
        <ScoutView
          brain={brain}
          onInvite={handleInvite}
          partnerHandles={ambassadors.map(a => (a.handle || '').toLowerCase())}
        />
      )}
    </div>
  )
}

const DEFAULT_HANDLES = [
  '@brendab.costa', '@lorena_maruch', '@bruna_acfreitas', '@teteclementino',
  '@anamaaro', '@jadesales', '@ligialapertosa', '@lafernandesss',
].join('\n')

function parseHandles(text) {
  return text.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean)
}

function ScoutView({ brain, onInvite, partnerHandles }) {
  const [input, setInput] = useState(DEFAULT_HANDLES)
  const [criterio, setCriterio] = useState('')
  const [results, setResults] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [analyzing, setAnalyzing] = useState(false)

  function runAnalysis() {
    const handles = parseHandles(input)
    if (!handles.length) return
    setAnalyzing(true)
    setTimeout(() => {
      setResults(analyzeHandles(handles, brain, criterio))
      setSelected(new Set())
      setAnalyzing(false)
    }, 450)
  }

  function suggestFromRadar() {
    setInput(scoutInfluencers(brain, partnerHandles).map(c => c.handle).join('\n'))
  }

  function toggle(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function addSelected() {
    if (!results) return
    results.filter(c => selected.has(c.id) && !partnerHandles.includes(c.handle.toLowerCase())).forEach(onInvite)
    setSelected(new Set())
  }

  return (
    <>
      <div className={styles.searchPanel}>
        <label className={styles.searchLabel}>✦ Pesquisar perfis — cole os @ que quer analisar</label>
        <textarea
          className={styles.searchArea}
          value={input}
          onChange={e => setInput(e.target.value)}
          rows={4}
          placeholder="@perfil1&#10;@perfil2&#10;@perfil3…"
        />
        <div className={styles.searchRow}>
          <input
            className={styles.criterioInput}
            value={criterio}
            onChange={e => setCriterio(e.target.value)}
            placeholder="Sua sugestão / critério (ex: foco em loiro, BH, micro)…"
            onKeyDown={e => { if (e.key === 'Enter') runAnalysis() }}
          />
          <button className="btn" type="button" onClick={suggestFromRadar}>Sugerir do radar</button>
          <button className="btn btn--primary" type="button" onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? 'Analisando…' : '▸ Analisar'}
          </button>
        </div>
        <p className={styles.searchHint}>
          A IA estima nicho, público e engajamento e ranqueia pela aderência à marca (diretriz do Cérebro da IA).
          Marque os que quiser e adicione de uma vez. Perfis fora da base aparecem com dados estimados.
        </p>
        <div className={styles.searchBible}>
          <BibleBadge to="/bible#conceito">
            O Scout só recomenda quem <strong>eleva a marca</strong> (luxo + alto padrão)
          </BibleBadge>
        </div>
      </div>

      {analyzing && <p className={styles.analyzing}>Analisando {parseHandles(input).length} perfis…</p>}

      {results && !analyzing && (
        <>
          <div className={styles.resultBar}>
            <span>{results.length} analisados · ordenados por aderência à marca</span>
            {selected.size > 0 && (
              <button className="btn btn--primary" onClick={addSelected}>
                + Adicionar {selected.size} selecionado{selected.size > 1 ? 's' : ''}
              </button>
            )}
          </div>
          <div className={styles.scoutGrid}>
            {results.map((c, i) => {
              const already = partnerHandles.includes(c.handle.toLowerCase())
              const sel = selected.has(c.id)
              return (
                <div key={c.id} className={`${styles.rec} ${styles['rt_' + c.veredito.tone]} ${sel ? styles.recSel : ''}`}>
                  <div className={styles.recTop}>
                    {!already && (
                      <input type="checkbox" className={styles.recCheck} checked={sel} onChange={() => toggle(c.id)} />
                    )}
                    <span className={styles.recRank}>{String(i + 1).padStart(2, '0')}</span>
                    <div className={styles.recId}>
                      <span className={styles.recNome}>
                        {c.nome}{c.estimated && <span className={styles.estTag}>estimado</span>}
                      </span>
                      <span className={styles.recHandle}>{c.handle} · {c.plataforma} · {c.tier}</span>
                    </div>
                    <div className={styles.recScore}>
                      <span className={`${styles.scoreNum} ${styles['st_' + c.veredito.tone]}`}>{c.score}</span>
                      <span className={styles.scoreMax}>/100</span>
                    </div>
                  </div>

                  <span className={`${styles.verdict} ${styles['v_' + c.veredito.tone]}`}>{c.veredito.label}</span>

                  <div className={styles.recMetrics}>
                    <span>{fmtCompact(c.seguidores)} seg.</span>
                    <span>{fmtPct(c.engajamento)} engaj.</span>
                    <span>{c.fem_pct}% fem.</span>
                    <span>{c.local}</span>
                  </div>

                  <div className={styles.recProsContras}>
                    {c.pros.slice(0, 3).map((p, j) => <p key={'p' + j} className={styles.pro}>+ {p}</p>)}
                    {c.contras.slice(0, 2).map((p, j) => <p key={'c' + j} className={styles.contra}>− {p}</p>)}
                  </div>

                  <div className={styles.recEstrategia}>
                    <span className={styles.estLabel}>ESTRATÉGIA</span>
                    <p>{c.estrategia}</p>
                  </div>

                  <div className={styles.recFoot}>
                    <span className={styles.recCusto}>Cachê estim. {fmtBRL(c.custo)}</span>
                    {already
                      ? <span className={styles.alreadyTag}>já é parceiro</span>
                      : <button className="btn btn--primary" onClick={() => onInvite(c)}>+ Adicionar</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function Field({ label, children }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  )
}

function Stat({ label, value, accent = null }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${accent ? styles.statAccent : ''}`}>{value}</span>
    </div>
  )
}
