import { useState, useMemo } from 'react'
import { useCompetitors, latestSnapshot, CONTENT_TAGS, CONTENT_DIMENSIONS } from '@/features/competitors/hooks/useCompetitors'
import { useInstagramMetrics } from '@/features/organic/instagram/hooks/useInstagramMetrics'
import { useToast } from '@/app/providers/ToastContext'
import CompetitorCard from '@/features/competitors/components/CompetitorCard'
import CompetitorComparisonChart from '@/features/competitors/components/CompetitorComparisonChart'
import BenchmarkPanel from '@/features/competitors/components/BenchmarkPanel'
import ValidatedContent from '@/features/competitors/components/ValidatedContent'
import ScriptGenerator from '@/features/competitors/components/ScriptGenerator'
import MarketRadar from '@/features/competitors/components/MarketRadar'
import InsightsPanel from '@/components/ui/InsightsPanel'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import BibleBadge from '@/components/ui/BibleBadge'
import styles from './CompetitorsPage.module.css'

const PALETTE = ['#E1306C', '#F58529', '#8134AF', '#1D9E75', '#185FA5', '#D85A30']

const VIEWS = [
  { key: 'concorrentes', label: 'Concorrentes' },
  { key: 'referencias',  label: 'Referências / embaixadores' },
  { key: 'radar',        label: 'Radar de mercado' },
]

export default function CompetitorsPage() {
  const { competitors, loading, usingLocal, addCompetitor, removeCompetitor, addSnapshot, addContent, removeContent } = useCompetitors()
  const { data: ig } = useInstagramMetrics()
  const toast = useToast()

  const [view, setView] = useState('concorrentes')
  const [showAdd, setShowAdd] = useState(false)
  const [snapshotFor, setSnapshotFor] = useState(null)
  const [contentFor, setContentFor] = useState(null)
  const [segmento, setSegmento] = useState('todos')

  const tipoAtual = view === 'referencias' ? 'referencia' : 'concorrente'
  const doTipo = competitors.filter(c => (c.tipo || 'concorrente') === tipoAtual)
  // segmentação por produto/empresa — espionagem por nicho
  const segmentos = useMemo(
    () => ['todos', ...new Set(doTipo.map(c => c.segmento).filter(Boolean))],
    [doTipo]
  )
  const visiveis = segmento === 'todos'
    ? doTipo
    : doTipo.filter(c => c.segmento === segmento)

  // "Você" — derivado das métricas do Instagram da plataforma
  const you = useMemo(() => {
    if (!ig?.account) return null
    const a = ig.account
    const reels = (ig.posts || []).filter(p => p.tipo !== 'STORY')
    const postsLast30 = reels.length
    return {
      nome: a.username || 'Você',
      seguidores: a.seguidores,
      engajamento_taxa: a.engajamento_taxa,
      posts_semana: +(postsLast30 / 4).toFixed(1),
      isYou: true,
    }
  }, [ig])

  // Benchmark/comparação usa só concorrentes diretos (não referências)
  const concorrentes = useMemo(
    () => competitors.filter(c => (c.tipo || 'concorrente') === 'concorrente'),
    [competitors]
  )

  const rivals = useMemo(() => {
    return concorrentes.map(c => {
      const snap = latestSnapshot(c)
      return {
        nome: c.nome,
        seguidores: snap?.seguidores || 0,
        engajamento_taxa: snap?.engajamento_taxa || 0,
        posts_semana: snap?.posts_semana || 0,
        reclame_aqui_nota: snap?.reclame_aqui_nota || 0,
      }
    })
  }, [concorrentes])

  // conteúdos validados achatados (para os insights da IA)
  const allContent = useMemo(() => {
    const rows = []
    competitors.forEach(c => {
      ;(c.content || []).forEach(ct => rows.push({ ...ct, competitorNome: c.nome }))
    })
    return rows
  }, [competitors])

  // séries para o gráfico de crescimento (só concorrentes)
  const chartSeries = useMemo(() => {
    const series: Array<{ label: string; cor: string; points: { date: string; value: number }[]; highlight?: boolean }> = concorrentes
      .map(c => {
        const snap = latestSnapshot(c)
        if (!snap?.series?.length) return null
        return {
          label: c.nome,
          cor: c.cor,
          points: snap.series.map(s => ({ date: s.date, value: s.seguidores })),
        }
      })
      .filter(Boolean) as Array<{ label: string; cor: string; points: { date: string; value: number }[]; highlight?: boolean }>

    // adiciona "Você" se houver série de seguidores
    if (ig?.account?.serie_seguidores?.length) {
      series.unshift({
        label: '★ ' + (ig.account.username || 'Você'),
        cor: '#185FA5',
        highlight: true,
        points: ig.account.serie_seguidores.map(s => ({ date: s.date, value: s.value })),
      })
    }
    return series
  }, [concorrentes, ig])

  async function handleAdd(form) {
    const usedColors = competitors.map(c => c.cor)
    const cor = PALETTE.find(c => !usedColors.includes(c)) || PALETTE[competitors.length % PALETTE.length]
    const { error } = await addCompetitor({ ...form, cor, tipo: tipoAtual })
    if (error) {
      toast.error('Erro ao adicionar perfil.')
    } else {
      toast.success(tipoAtual === 'referencia' ? 'Referência adicionada!' : 'Concorrente adicionado!')
      setShowAdd(false)
    }
  }

  async function handleSnapshot(form) {
    const { error } = await addSnapshot(snapshotFor.id, form)
    if (error) toast.error('Erro ao registrar snapshot.')
    else { toast.success('Snapshot registrado!'); setSnapshotFor(null) }
  }

  async function handleRemove(id) {
    await removeCompetitor(id)
    toast.info('Concorrente removido.')
  }

  async function handleAddContent(form) {
    const { error } = await addContent(contentFor.id, form)
    if (error) toast.error('Erro ao registrar conteúdo.')
    else { toast.success('Conteúdo validado registrado!'); setContentFor(null) }
  }

  async function handleRemoveContent(competitorId, contentId) {
    await removeContent(competitorId, contentId)
    toast.info('Conteúdo removido.')
  }

  return (
    <div className={styles.page}>
      <PageHeader
        section="competitors"
        title="Espionagem competitiva"
        subtitle="Monitore concorrentes e referências — métricas, reputação e conteúdo"
        actions={
          <button className="btn btn--primary" onClick={() => setShowAdd(true)}>
            {tipoAtual === 'referencia' ? '+ Nova referência' : '+ Novo concorrente'}
          </button>
        }
      />

      <div className={styles.infoBox}>
        ⓘ As APIs não expõem dados de terceiros. Aqui você registra os números públicos (seguidores,
        engajamento, reputação no Reclame Aqui) periodicamente — a plataforma cuida da comparação,
        gráficos e insights. {usingLocal && 'Modo local: dados salvos só no navegador.'}
      </div>

      <Tabs
        items={VIEWS.map(v => ({ id: v.key, label: v.label }))}
        activeId={view}
        onChange={setView}
        accentColor="var(--section-competitors)"
      />

      <div className={styles.bibleStrip}>
        <BibleBadge to="/bible#diretriz">
          Copie o que funciona, mas <strong>sempre filtre pelo padrão TBC</strong> (luxo + alto nível)
        </BibleBadge>
      </div>

      {loading ? (
        <div className={styles.loading}>Carregando perfis monitorados...</div>
      ) : view === 'radar' ? (
        <MarketRadar />
      ) : (
        <>
          {view === 'referencias' && (
            <div className={styles.infoBox}>
              ⭐ Referências e embaixadores são perfis que você <strong>quer modelar</strong> — figuras
              de sucesso cujos formatos de conteúdo servem de molde. Não entram na comparação de benchmark,
              mas o conteúdo deles alimenta o "DNA do conteúdo vencedor".
            </div>
          )}

          <section className={styles.section}>
            <div className={styles.sectionHeadRow}>
              <h2 className={styles.sectionTitle}>
                {tipoAtual === 'referencia' ? 'Referências monitoradas' : 'Concorrentes monitorados'}
              </h2>
              {segmentos.length > 2 && (
                <select
                  className={styles.segSelect}
                  value={segmento}
                  onChange={e => setSegmento(e.target.value)}
                >
                  {segmentos.map(s => (
                    <option key={s} value={s}>{s === 'todos' ? 'Todos os segmentos' : s}</option>
                  ))}
                </select>
              )}
            </div>
            {visiveis.length === 0 ? (
              <div className={styles.empty}>
                Nenhum perfil cadastrado nesta aba. Clique em <strong>{tipoAtual === 'referencia' ? '+ Nova referência' : '+ Novo concorrente'}</strong> para começar.
              </div>
            ) : (
              <div className={styles.cardGrid}>
                {visiveis.map(c => (
                  <CompetitorCard
                    key={c.id}
                    competitor={c}
                    you={tipoAtual === 'concorrente' ? you : null}
                    onSnapshot={setSnapshotFor}
                    onContent={setContentFor}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </section>

          {view === 'concorrentes' && chartSeries.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Crescimento de seguidores</h2>
              <div className={styles.chartCard}>
                <CompetitorComparisonChart series={chartSeries} metricLabel="Seguidores" />
              </div>
            </section>
          )}

          {view === 'concorrentes' && rivals.length > 0 && (
            <section className={styles.section}>
              <BenchmarkPanel you={you} rivals={rivals} />
            </section>
          )}

          {view === 'concorrentes' && rivals.length > 0 && you && (
            <section className={styles.section}>
              <InsightsPanel source="competitors" you={you} rivals={rivals} content={allContent} />
            </section>
          )}

          <section className={styles.section}>
            <ValidatedContent
              competitors={competitors}
              onLogContent={setContentFor}
              onRemoveContent={handleRemoveContent}
            />
          </section>

          <section className={styles.section}>
            <ScriptGenerator competitors={competitors} />
          </section>

          <section className={styles.section}>
            <div className={styles.adLibCard}>
              <div className={styles.adLibIcon}>📢</div>
              <div className={styles.adLibBody}>
                <h3 className={styles.adLibTitle}>Radar de anúncios</h3>
                <p className={styles.adLibText}>
                  A <strong>Meta Ad Library</strong> mostra publicamente todos os anúncios ativos de qualquer
                  página — criativo, formato e data de início (não mostra gasto). Use para espiar a estratégia
                  dos concorrentes.
                </p>
                <a
                  href="https://www.facebook.com/ads/library/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.adLibLink}
                >
                  Abrir Meta Ad Library ↗
                </a>
              </div>
            </div>
          </section>
        </>
      )}

      {showAdd && (
        <AddCompetitorModal tipo={tipoAtual} onClose={() => setShowAdd(false)} onSave={handleAdd} />
      )}
      {snapshotFor && (
        <SnapshotModal competitor={snapshotFor} onClose={() => setSnapshotFor(null)} onSave={handleSnapshot} />
      )}
      {contentFor && (
        <ContentModal competitor={contentFor} onClose={() => setContentFor(null)} onSave={handleAddContent} />
      )}
    </div>
  )
}

function ContentModal({ competitor, onClose, onSave }) {
  const [form, setForm] = useState({
    tipo: 'REEL', tag: 'antes-depois', tema: '', permalink: '',
    curtidas: '', comentarios: '', engajamento_taxa: '', formato_nota: '',
    gancho: 'resultado', emocao: 'surpresa', audio: 'trend', ritmo_edicao: 'cortes-rapidos',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const valid = form.tema.trim().length > 0

  return (
    <Modal title={`Conteúdo validado — ${competitor.nome}`} onClose={onClose}>
      <p className={styles.modalHint}>
        Viu um post de <strong>{competitor.handle || competitor.nome}</strong> performando bem?
        Registre aqui — quanto mais detalhe, melhor a IA extrai o padrão vencedor.
      </p>
      <div className={styles.modalGrid}>
        <Field label="Tipo">
          <select className={styles.input} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            <option value="REEL">Reel</option>
            <option value="IMAGE">Imagem</option>
            <option value="CAROUSEL">Carrossel</option>
            <option value="STORY">Story</option>
          </select>
        </Field>
        <Field label="Categoria do conteúdo">
          <select className={styles.input} value={form.tag} onChange={e => set('tag', e.target.value)}>
            {CONTENT_TAGS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Tema / descrição do conteúdo">
        <input className={styles.input} value={form.tema} onChange={e => set('tema', e.target.value)} placeholder="Ex: Antes e depois — progressiva" />
      </Field>

      <div className={styles.modalSectionLabel}>Análise do formato (o "como")</div>
      <div className={styles.modalGrid}>
        {Object.entries(CONTENT_DIMENSIONS).map(([dim, conf]) => (
          <Field key={dim} label={conf.label}>
            <select className={styles.input} value={form[dim]} onChange={e => set(dim, e.target.value)}>
              {conf.options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </Field>
        ))}
      </div>

      <div className={styles.modalSectionLabel}>Performance</div>
      <div className={styles.modalGrid}>
        <Field label="Curtidas">
          <input className={styles.input} type="number" value={form.curtidas} onChange={e => set('curtidas', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Comentários">
          <input className={styles.input} type="number" value={form.comentarios} onChange={e => set('comentarios', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Engajamento % (estimado)">
          <input className={styles.input} type="number" step="0.1" value={form.engajamento_taxa} onChange={e => set('engajamento_taxa', e.target.value)} placeholder="0.0" />
        </Field>
        <Field label="Link do post (opcional)">
          <input className={styles.input} value={form.permalink} onChange={e => set('permalink', e.target.value)} placeholder="https://instagram.com/p/..." />
        </Field>
      </div>
      <Field label="Observação livre (opcional)">
        <input className={styles.input} value={form.formato_nota} onChange={e => set('formato_nota', e.target.value)} placeholder="Ex: legenda passo a passo, CTA no final" />
      </Field>
      <button className={styles.modalSave} onClick={() => valid && onSave(form)} disabled={!valid}>
        Registrar conteúdo validado
      </button>
    </Modal>
  )
}

function AddCompetitorModal({ tipo, onClose, onSave }) {
  const isRef = tipo === 'referencia'
  const [form, setForm] = useState({
    nome: '', handle: '',
    segmento: isRef ? 'Cabeleireira de referência' : 'Salão de beleza',
    website: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal title={isRef ? 'Nova referência' : 'Novo concorrente'} onClose={onClose}>
      <Field label="Nome">
        <input className={styles.input} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder={isRef ? 'Ex: Lorena Hair' : 'Ex: Studio Glam'} />
      </Field>
      <Field label="@ do Instagram">
        <input className={styles.input} value={form.handle} onChange={e => set('handle', e.target.value)} placeholder="@perfil" />
      </Field>
      <Field label="Segmento / nicho">
        <input className={styles.input} value={form.segmento} onChange={e => set('segmento', e.target.value)} />
      </Field>
      <Field label="Website (opcional)">
        <input className={styles.input} value={form.website} onChange={e => set('website', e.target.value)} placeholder="site.com.br" />
      </Field>
      <button
        className={styles.modalSave}
        onClick={() => form.nome.trim() && onSave(form)}
        disabled={!form.nome.trim()}
      >
        {isRef ? 'Adicionar referência' : 'Adicionar concorrente'}
      </button>
    </Modal>
  )
}

function SnapshotModal({ competitor, onClose, onSave }) {
  const [form, setForm] = useState({
    seguidores: '', total_posts: '', engajamento_taxa: '', posts_semana: '',
    seguidores_tiktok: '', seguidores_youtube: '', seguidores_facebook: '',
    reclame_aqui_nota: '', reclame_aqui_reclamacoes: '', reclame_aqui_resolvidas_pct: '',
    observacoes: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const valid = Number(form.seguidores) > 0

  return (
    <Modal title={`Snapshot — ${competitor.nome}`} onClose={onClose}>
      <p className={styles.modalHint}>
        Abra os perfis públicos de <strong>{competitor.handle || competitor.nome}</strong> e copie os números visíveis.
      </p>

      <div className={styles.modalSectionLabel}>Instagram</div>
      <div className={styles.modalGrid}>
        <Field label="Seguidores">
          <input className={styles.input} type="number" value={form.seguidores} onChange={e => set('seguidores', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Total de posts">
          <input className={styles.input} type="number" value={form.total_posts} onChange={e => set('total_posts', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Engajamento % (estimado)">
          <input className={styles.input} type="number" step="0.1" value={form.engajamento_taxa} onChange={e => set('engajamento_taxa', e.target.value)} placeholder="0.0" />
        </Field>
        <Field label="Posts por semana">
          <input className={styles.input} type="number" step="0.5" value={form.posts_semana} onChange={e => set('posts_semana', e.target.value)} placeholder="0" />
        </Field>
      </div>

      <div className={styles.modalSectionLabel}>Outras redes (seguidores)</div>
      <div className={styles.modalGrid}>
        <Field label="TikTok">
          <input className={styles.input} type="number" value={form.seguidores_tiktok} onChange={e => set('seguidores_tiktok', e.target.value)} placeholder="0" />
        </Field>
        <Field label="YouTube">
          <input className={styles.input} type="number" value={form.seguidores_youtube} onChange={e => set('seguidores_youtube', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Facebook">
          <input className={styles.input} type="number" value={form.seguidores_facebook} onChange={e => set('seguidores_facebook', e.target.value)} placeholder="0" />
        </Field>
      </div>

      <div className={styles.modalSectionLabel}>Reputação (Reclame Aqui)</div>
      <div className={styles.modalGrid}>
        <Field label="Nota (0 a 10)">
          <input className={styles.input} type="number" step="0.1" max="10" value={form.reclame_aqui_nota} onChange={e => set('reclame_aqui_nota', e.target.value)} placeholder="0.0" />
        </Field>
        <Field label="Nº de reclamações">
          <input className={styles.input} type="number" value={form.reclame_aqui_reclamacoes} onChange={e => set('reclame_aqui_reclamacoes', e.target.value)} placeholder="0" />
        </Field>
        <Field label="% resolvidas">
          <input className={styles.input} type="number" step="1" max="100" value={form.reclame_aqui_resolvidas_pct} onChange={e => set('reclame_aqui_resolvidas_pct', e.target.value)} placeholder="0" />
        </Field>
      </div>

      <Field label="Observações (opcional)">
        <input className={styles.input} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="Ex: lançou promo de dia das mães" />
      </Field>
      <button className={styles.modalSave} onClick={() => valid && onSave(form)} disabled={!valid}>
        Registrar snapshot
      </button>
    </Modal>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}
