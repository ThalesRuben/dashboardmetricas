import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useToast } from '@/app/providers/ToastContext'
import { useAiBrain, BRAIN_FIELDS } from '@/features/ai'
import { analyzeViral, VIRAL_PRESETS } from '@/features/organic/instagram/lib/viralAnalysis'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import styles from './AiHubPage.module.css'

const TABS = [
  { key: 'viral',  label: 'Análise de virais' },
  { key: 'brain',  label: 'Cérebro da IA' },
  { key: 'prompt', label: 'Prompt do Gemini' },
]

const FORM_FIELDS = [
  { key: 'titulo',            label: 'Título / tema do vídeo', type: 'text' },
  { key: 'plataforma',        label: 'Plataforma',             type: 'text' },
  { key: 'views',             label: 'Visualizações',          type: 'number' },
  { key: 'curtidas',          label: 'Curtidas',               type: 'number' },
  { key: 'comentarios',       label: 'Comentários',            type: 'number' },
  { key: 'compartilhamentos', label: 'Compartilhamentos',      type: 'number' },
  { key: 'salvamentos',       label: 'Salvamentos',            type: 'number' },
  { key: 'duracao',           label: 'Duração (s)',            type: 'number' },
]

function buildMktPrompt(brain) {
  return `Você é o estrategista de marketing da marca. Use SEMPRE este contexto ao gerar copy, roteiros e análises.

# NORTE ESTRATÉGICO
${brain.norte}

# PÚBLICO-ALVO
${brain.publico_alvo}

# TOM DE VOZ
${brain.tom_de_voz}

# OFERTAS ATUAIS
${brain.ofertas_atuais}

# DIFERENCIAIS
${brain.diferenciais}

# RESTRIÇÕES — NUNCA FAÇA
${brain.evitar}

# PALAVRAS-CHAVE DA MARCA
${brain.palavras_chave}

Ao receber as métricas de um vídeo, explique por que ele performou, pontue os fatores de
viralização e gere ganchos, legenda, CTAs e um roteiro adaptado — tudo coerente com o contexto acima.`
}

export default function AiHubPage() {
  const [tab, setTab] = useState('viral')
  const { brain, save, loading: brainLoading } = useAiBrain()
  const toast = useToast()

  return (
    <div className={styles.page}>
      <PageHeader
        section="ia"
        title="Central de IA"
        subtitle="Análise de virais, diretriz de marketing e prompt do Gemini"
      />

      <Tabs
        items={TABS.map(t => ({ id: t.key, label: t.label }))}
        activeId={tab}
        onChange={setTab}
        accentColor="var(--section-ia)"
      />

      {tab === 'viral'  && <ViralTab brain={brain} toast={toast} />}
      {tab === 'brain'  && <BrainTab key={brainLoading ? 'load' : 'ready'} brain={brain} save={save} loading={brainLoading} toast={toast} />}
      {tab === 'prompt' && <PromptTab prompt={buildMktPrompt(brain)} toast={toast} />}
    </div>
  )
}

/* ---------------- Análise de virais ---------------- */
function ViralTab({ brain, toast }) {
  const [form, setForm] = useState({ ...VIRAL_PRESETS[0] })
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function run() {
    setRunning(true)
    let analysis
    try {
      // tenta a Edge Function (Gemini). Cai para o motor local se indisponível.
      const { data, error } = await supabase.functions.invoke('gemini-analyze', {
        body: { video: form, brain },
      })
      analysis = (!error && data?.score) ? data : analyzeViral(form, brain)
    } catch {
      analysis = analyzeViral(form, brain)
    }
    setResult(analysis)
    setRunning(false)
  }

  function copy(text, label) {
    navigator.clipboard?.writeText(text)
    toast.success(`${label} copiado.`)
  }

  return (
    <div className={styles.viralGrid}>
      <div className={`${styles.card}`}>
        <h3 className={styles.cardTitle}>Dados do conteúdo</h3>
        <div className={styles.presets}>
          {VIRAL_PRESETS.map((p, i) => (
            <button key={i} className="cc-btn" onClick={() => { setForm({ ...p }); setResult(null) }}>
              {p.plataforma}
            </button>
          ))}
        </div>
        <div className={styles.form}>
          {FORM_FIELDS.map(f => (
            <label key={f.key} className={styles.field}>
              <span className={styles.fieldLabel}>{f.label}</span>
              <input
                className={styles.input}
                type={f.type}
                value={form[f.key] ?? ''}
                onChange={e => setField(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
              />
            </label>
          ))}
        </div>
        <button className="cc-btn cc-btn--solid" style={{ width: '100%', justifyContent: 'center' }} onClick={run} disabled={running}>
          {running ? 'Analisando...' : '▸ Analisar viralização'}
        </button>
      </div>

      <div className={styles.resultCol}>
        {!result ? (
          <div className={`${styles.card} ${styles.empty}`}>
            Preencha os dados de um vídeo e rode a análise para entender por que ele
            performou — e receber copy e roteiro adaptados.
          </div>
        ) : (
          <>
            <div className={`${styles.card}`}>
              <div className={styles.scoreRow}>
                <div className={styles.scoreBox}>
                  <span className={styles.scoreNum}>{result.score}</span>
                  <span className={styles.scoreMax}>/100</span>
                </div>
                <div>
                  <span className={`${styles.verdict} ${styles['vt_' + result.veredito.tone]}`}>
                    {result.veredito.label}
                  </span>
                  <p className={styles.modelo}>motor: {result.modelo}</p>
                </div>
              </div>
              <div className={styles.fatores}>
                {result.fatores.map(f => (
                  <div key={f.dimensao} className={styles.fator}>
                    <div className={styles.fatorTop}>
                      <span>{f.dimensao}</span>
                      <span className={styles.fatorVal}>{f.valor}</span>
                    </div>
                    <div className={styles.fatorTrack}>
                      <span className={styles.fatorFill} style={{ width: `${f.valor}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${styles.card}`}>
              <h3 className={styles.cardTitle}>Por que viralizou</h3>
              <ul className={styles.why}>
                {result.porque.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>

            <div className={`${styles.card}`}>
              <div className={styles.cardTitleRow}>
                <h3 className={styles.cardTitle}>Copy gerada</h3>
                <button className="cc-btn" onClick={() => copy(
                  `GANCHOS:\n${result.copy.ganchos.join('\n')}\n\nLEGENDA:\n${result.copy.legenda}\n\nCTAs:\n${result.copy.cta.join('\n')}`,
                  'Copy'
                )}>Copiar tudo</button>
              </div>
              <div className={styles.copyBlock}>
                <span className={styles.copyLabel}>Ganchos</span>
                {result.copy.ganchos.map((g, i) => <p key={i} className={styles.copyLine}>{g}</p>)}
              </div>
              <div className={styles.copyBlock}>
                <span className={styles.copyLabel}>Legenda</span>
                <p className={styles.copyLine}>{result.copy.legenda}</p>
              </div>
              <div className={styles.copyBlock}>
                <span className={styles.copyLabel}>CTAs</span>
                {result.copy.cta.map((c, i) => <p key={i} className={styles.copyLine}>{c}</p>)}
              </div>
            </div>

            <div className={`${styles.card}`}>
              <h3 className={styles.cardTitle}>Roteiro adaptado</h3>
              <div className={styles.roteiro}>
                {result.roteiro.map((r, i) => (
                  <div key={i} className={styles.roteiroRow}>
                    <span className={styles.roteiroTempo}>{r.tempo}</span>
                    <span className={styles.roteiroAcao}>{r.acao}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------- Cérebro da IA ---------------- */
function BrainTab({ brain, save, loading, toast }) {
  const [draft, setDraft] = useState(brain)
  const [saving, setSaving] = useState(false)

  if (loading) return <div className={styles.card}>Carregando...</div>

  async function handleSave() {
    setSaving(true)
    await save(draft)
    setSaving(false)
    toast.success('Diretriz de marketing salva. A IA usará esse contexto.')
  }

  return (
    <div className={`${styles.card}`}>
      <h3 className={styles.cardTitle}>Diretriz de marketing — contexto da IA</h3>
      <p className={styles.brainHint}>
        Tudo que a IA gera (análise de virais, copy, roteiros) parte deste contexto.
        Mantenha sempre atualizado.
      </p>
      <div className={styles.brainForm}>
        {BRAIN_FIELDS.map(f => (
          <label key={f.key} className={styles.field}>
            <span className={styles.fieldLabel}>{f.label}</span>
            <span className={styles.fieldHint}>{f.hint}</span>
            <textarea
              className={styles.textarea}
              rows={2}
              value={draft[f.key] ?? ''}
              onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <button className="cc-btn cc-btn--solid" onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando...' : '▸ Salvar diretriz'}
      </button>
    </div>
  )
}

/* ---------------- Prompt do Gemini ---------------- */
function PromptTab({ prompt, toast }) {
  return (
    <div className={`${styles.card}`}>
      <div className={styles.cardTitleRow}>
        <h3 className={styles.cardTitle}>Prompt de sistema — API do Gemini</h3>
        <button className="cc-btn" onClick={() => { navigator.clipboard?.writeText(prompt); toast.success('Prompt copiado.') }}>
          Copiar prompt
        </button>
      </div>
      <p className={styles.brainHint}>
        Gerado automaticamente a partir do "Cérebro da IA". É o prompt enviado à Edge Function
        <strong> gemini-analyze</strong>. Para ativar a IA real, configure a variável
        <strong> GEMINI_API_KEY</strong> no Supabase e faça deploy da função.
      </p>
      <pre className={styles.promptBox}>{prompt}</pre>
    </div>
  )
}
