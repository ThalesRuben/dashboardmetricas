import { useMemo, useState } from 'react'
import { useWhatsAppTemplates } from '../hooks/useWhatsAppTemplates'
import { useWhatsAppNumbers } from '../hooks/useWhatsAppNumbers'
import type {
  WhatsAppTemplate,
  WhatsAppTemplateInput,
  WhatsAppTemplateStatus,
  WhatsAppTemplateCategory,
  WhatsAppTemplateComponent,
} from '../api/types'
import styles from './TemplatesPanel.module.css'

type FiltroStatus = 'todos' | WhatsAppTemplateStatus

const STATUS_LABEL: Record<WhatsAppTemplateStatus, string> = {
  draft:    'Rascunho',
  pending:  'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  paused:   'Pausado',
  disabled: 'Desabilitado',
}

const CATEGORY_LABEL: Record<WhatsAppTemplateCategory, string> = {
  MARKETING:      'Marketing',
  UTILITY:        'Utility',
  AUTHENTICATION: 'Autenticação',
}

export default function TemplatesPanel() {
  const { templates, loading, erro, refresh, criar, remover, sincronizar } = useWhatsAppTemplates()
  const { numeros } = useWhatsAppNumbers()

  const [filtro, setFiltro] = useState<FiltroStatus>('todos')
  const [busca, setBusca] = useState('')
  const [criandoNovo, setCriandoNovo] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [erroSync, setErroSync] = useState<string | null>(null)

  const temNumeroOficial = numeros.some(n => n.provider === 'meta_official' && n.ativo)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return templates.filter(t => {
      if (filtro !== 'todos' && t.status !== filtro) return false
      if (q && !t.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [templates, filtro, busca])

  async function handleCriar(input: WhatsAppTemplateInput) {
    await criar(input)
    setCriandoNovo(false)
  }

  async function handleRemover(t: WhatsAppTemplate) {
    const hard = t.status === 'approved' || t.status === 'pending' || t.status === 'paused'
    const label = hard ? 'Deletar (inclusive na Meta)' : 'Remover localmente'
    const ok = window.confirm(`${label} o template "${t.name}"?`)
    if (!ok) return
    await remover(t.id, hard)
  }

  async function handleSync() {
    setSincronizando(true)
    setErroSync(null)
    try {
      await sincronizar()
    } catch (e) {
      setErroSync(e instanceof Error ? e.message : String(e))
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.h2}>Templates HSM</h2>
          <p className={styles.subtitle}>
            Templates aprovados pela Meta pra disparo fora da janela de 24h. Cada template precisa ser
            submetido e aprovado antes de virar opção no disparo em massa. Aprovação leva de minutos a
            24h.
          </p>
        </div>
        <div className={styles.headActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={handleSync}
            disabled={sincronizando}
            title="Puxar status atualizado da Meta"
          >
            {sincronizando ? 'Sincronizando...' : 'Sincronizar com Meta'}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setCriandoNovo(true)}
            disabled={!temNumeroOficial}
            title={!temNumeroOficial ? 'Cadastre um número Meta Oficial primeiro' : ''}
          >
            + Novo template
          </button>
        </div>
      </div>

      {!temNumeroOficial && (
        <div className={styles.info}>
          Templates só fazem sentido pra números <strong>Meta Cloud API</strong>. Cadastre um em
          <strong> Números</strong> primeiro.
        </div>
      )}

      {(erro || erroSync) && (
        <div className={styles.error}>
          {erro || erroSync}{' '}
          <button type="button" className={styles.linkBtn} onClick={refresh}>recarregar</button>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.chips}>
          {(['todos','draft','pending','approved','rejected','paused','disabled'] as FiltroStatus[]).map(s => (
            <button
              key={s}
              type="button"
              className={`${styles.chip} ${filtro === s ? styles.chipOn : ''}`}
              onClick={() => setFiltro(s)}
            >
              {s === 'todos' ? 'Todos' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <input
          type="search"
          className={styles.search}
          placeholder="Buscar por nome..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {loading ? (
        <p className={styles.loading}>Carregando templates...</p>
      ) : filtrados.length === 0 ? (
        templates.length === 0 ? (
          <EmptyState onNovo={() => setCriandoNovo(true)} disabled={!temNumeroOficial} />
        ) : (
          <p className={styles.empty}>Nada nesse filtro.</p>
        )
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Idioma</th>
              <th>Status</th>
              <th>Atualizado</th>
              <th aria-label="ações"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(t => (
              <TemplateRow key={t.id} template={t} onRemover={() => handleRemover(t)} />
            ))}
          </tbody>
        </table>
      )}

      {criandoNovo && (
        <TemplateModal
          onClose={() => setCriandoNovo(false)}
          onSalvar={handleCriar}
        />
      )}
    </div>
  )
}

function TemplateRow({
  template,
  onRemover,
}: {
  template: WhatsAppTemplate
  onRemover: () => void
}) {
  const body = template.components.find(c => c.type === 'BODY') as
    | Extract<WhatsAppTemplateComponent, { type: 'BODY' }> | undefined
  return (
    <>
      <tr>
        <td>
          <strong className={styles.tName}>{template.name}</strong>
          {body && <span className={styles.tPreview}>{body.text}</span>}
        </td>
        <td>{CATEGORY_LABEL[template.category]}</td>
        <td className={styles.mono}>{template.language}</td>
        <td>
          <span className={`${styles.pill} ${styles['p_' + template.status]}`}>
            {STATUS_LABEL[template.status]}
          </span>
        </td>
        <td className={styles.dim}>{fmtHora(template.atualizado_em)}</td>
        <td className={styles.actionsCell}>
          <button type="button" className={`${styles.linkBtn} ${styles.danger}`} onClick={onRemover}>
            Remover
          </button>
        </td>
      </tr>
      {template.status === 'rejected' && template.motivo_rejeicao && (
        <tr className={styles.rejectRow}>
          <td colSpan={6}>
            <span className={styles.rejectLabel}>Motivo:</span> {template.motivo_rejeicao}
          </td>
        </tr>
      )}
    </>
  )
}

function EmptyState({ onNovo, disabled }: { onNovo: () => void; disabled: boolean }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>Nenhum template cadastrado.</p>
      <p className={styles.emptyText}>
        Templates são obrigatórios pra iniciar conversa com contatos fora da janela de 24h. Comece
        criando um utilitário simples (ex: <code>confirma_horario</code>) — a aprovação da Meta costuma
        ser rápida em utility.
      </p>
      <button type="button" className={styles.btnPrimary} onClick={onNovo} disabled={disabled}>
        + Criar primeiro template
      </button>
    </div>
  )
}

// ------------------------------------------------------------
// Modal de criação
// ------------------------------------------------------------

interface ModalProps {
  onClose: () => void
  onSalvar: (input: WhatsAppTemplateInput) => Promise<void>
}

const LANGUAGES = [
  { value: 'pt_BR', label: 'Português (Brasil)' },
  { value: 'pt_PT', label: 'Português (Portugal)' },
  { value: 'en_US', label: 'Inglês (EUA)' },
  { value: 'es_ES', label: 'Espanhol' },
]

function TemplateModal({ onClose, onSalvar }: ModalProps) {
  const [name, setName]         = useState('')
  const [language, setLanguage] = useState('pt_BR')
  const [category, setCategory] = useState<WhatsAppTemplateCategory>('UTILITY')
  const [body, setBody]         = useState('')
  const [footer, setFooter]     = useState('')
  const [examplesRaw, setExamplesRaw] = useState('')  // separados por |
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const nameValido = /^[a-z0-9_]{1,512}$/.test(name)
  const bodyLen = body.length
  const bodyValido = bodyLen > 0 && bodyLen <= 1024
  const vars = useMemo(() => {
    const m = new Set<string>()
    body.replace(/\{\{(\d+)\}\}/g, (_, i) => { m.add(i); return _ })
    return [...m].sort((a, b) => Number(a) - Number(b))
  }, [body])

  const examples = useMemo(
    () => examplesRaw.split('|').map(s => s.trim()).filter(Boolean),
    [examplesRaw],
  )
  const examplesOk = vars.length === 0 || examples.length >= vars.length

  // Warnings client-side (não bloqueiam, mas alertam antes de submeter).
  const warnings = useMemo(() => {
    const w: string[] = []
    if (category === 'MARKETING' && /clique\s+aqui|click\s+here/i.test(body)) {
      w.push('Marketing com "clique aqui" costuma ser rejeitado.')
    }
    if (/https?:\/\/(bit\.ly|goo\.gl|tinyurl\.com)/i.test(body)) {
      w.push('URLs encurtadas costumam ser rejeitadas.')
    }
    if (category === 'UTILITY' && /promo|desconto|oferta/i.test(body)) {
      w.push('Tom promocional em Utility é comum de rejeitar — considere trocar pra Marketing.')
    }
    return w
  }, [body, category])

  const podeSalvar = nameValido && bodyValido && examplesOk && !salvando

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar) return
    setSalvando(true)
    setErro(null)
    const components: WhatsAppTemplateComponent[] = []
    const bodyComp: Extract<WhatsAppTemplateComponent, { type: 'BODY' }> = {
      type: 'BODY',
      text: body.trim(),
    }
    if (vars.length > 0) {
      bodyComp.example = { body_text: [examples.slice(0, vars.length)] }
    }
    components.push(bodyComp)
    if (footer.trim()) {
      components.push({ type: 'FOOTER', text: footer.trim() })
    }
    try {
      await onSalvar({ name: name.trim(), language, category, components })
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  const previewBody = aplicarVars(body, examples)

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <form className={styles.modal} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <header className={styles.modalHead}>
          <h3>Novo template</h3>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className={styles.modalGrid}>
          <div className={styles.modalCol}>
            <label className={styles.field}>
              <span className={styles.label}>Nome (slug) *</span>
              <input
                className={styles.input}
                placeholder="ex: confirma_horario"
                value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                autoFocus
              />
              <span className={styles.hint}>
                Só letras minúsculas, dígitos e <code>_</code>. Nome é único por idioma na WABA — não dá pra reusar.
              </span>
            </label>

            <div className={styles.row2}>
              <label className={styles.field}>
                <span className={styles.label}>Idioma *</span>
                <select
                  className={styles.input}
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                >
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Categoria *</span>
                <select
                  className={styles.input}
                  value={category}
                  onChange={e => setCategory(e.target.value as WhatsAppTemplateCategory)}
                >
                  <option value="UTILITY">Utility (transacional)</option>
                  <option value="MARKETING">Marketing (promocional)</option>
                  <option value="AUTHENTICATION">Autenticação (OTP)</option>
                </select>
              </label>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Body * <span className={styles.dim}>({bodyLen}/1024)</span></span>
              <textarea
                className={styles.textarea}
                rows={4}
                placeholder="Oi {{1}}, seu horário de {{2}} está confirmado ✨"
                value={body}
                onChange={e => setBody(e.target.value)}
              />
              <span className={styles.hint}>
                Use <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>… pra variáveis.
                {vars.length > 0 && <> Detectadas: {vars.map(v => <code key={v}>{'{{' + v + '}}'}</code>).reduce((a, b) => <>{a} {b}</>)}</>}
              </span>
            </label>

            {vars.length > 0 && (
              <label className={styles.field}>
                <span className={styles.label}>Exemplos das variáveis * <span className={styles.dim}>(separados por |)</span></span>
                <input
                  className={styles.input}
                  placeholder="Marina | sábado às 14h"
                  value={examplesRaw}
                  onChange={e => setExamplesRaw(e.target.value)}
                />
                <span className={styles.hint}>
                  A Meta exige exemplo pra cada variável (usado só na revisão, o cliente não vê).
                  {!examplesOk && ` Faltam ${vars.length - examples.length} exemplo(s).`}
                </span>
              </label>
            )}

            <label className={styles.field}>
              <span className={styles.label}>Footer (opcional)</span>
              <input
                className={styles.input}
                placeholder="ex: The Blonde Concept"
                value={footer}
                onChange={e => setFooter(e.target.value)}
              />
            </label>

            {warnings.length > 0 && (
              <div className={styles.warn}>
                <strong>Atenção:</strong>
                <ul>
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {erro && <div className={styles.error}>{erro}</div>}
          </div>

          <div className={styles.modalCol}>
            <span className={styles.label}>Preview</span>
            <div className={styles.preview}>
              <div className={styles.balao}>
                <span className={styles.balaoText}>{previewBody || 'Digite o body à esquerda…'}</span>
                {footer && <span className={styles.balaoFooter}>{footer}</span>}
              </div>
              <span className={styles.previewHint}>
                Prévia com os exemplos preenchidos. Botões e header ainda não são suportados nessa
                versão do form — dá pra criar direto na Meta e ressincronizar.
              </span>
            </div>
          </div>
        </div>

        <footer className={styles.modalFoot}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary} disabled={!podeSalvar}>
            {salvando ? 'Submetendo...' : 'Submeter pra aprovação'}
          </button>
        </footer>
      </form>
    </div>
  )
}

function aplicarVars(template: string, params: string[]): string {
  return template.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
    const i = Number(idx) - 1
    return params[i] != null && params[i] !== '' ? String(params[i]) : `{{${idx}}}`
  })
}

function fmtHora(iso: string): string {
  try {
    const d = new Date(iso)
    const diffMs = Date.now() - d.getTime()
    const diffH = Math.floor(diffMs / 3600000)
    if (diffH < 1) return 'há minutos'
    if (diffH < 24) return `há ${diffH}h`
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) return `há ${diffD}d`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch { return iso }
}
