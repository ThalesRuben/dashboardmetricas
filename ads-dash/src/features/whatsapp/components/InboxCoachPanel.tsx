import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAiBrain } from '@/features/ai'
import { crmRepo } from '../api/crmRepo'
import type { WhatsAppThreadReal, WhatsAppMsgReal } from '../api/types'
import styles from './InboxCoachPanel.module.css'

interface InsightItem {
  tone: 'success' | 'warning' | 'danger' | 'info'
  title: string
  body: string
}

interface AnaliseTempo {
  gap_medio_min: number | null
  pior_gap_min: number | null
  inatividade_atual_min: number | null
  janela_dominante: string
  comentario: string
}

interface CoachResult {
  modelo?: string
  primeiro_nome?: string
  resumo?: string
  score_lead?: number
  tag_sugerida?: 'quente' | 'morno' | 'frio'
  nao_comercial?: boolean
  sinais_de_compra?: string[]
  objecoes_abertas?: string[]
  proxima_resposta?: string
  proximos_passos?: string[]
  reativacao_necessaria?: boolean
  analise_tempo?: AnaliseTempo
  analise?: InsightItem[]
  oportunidades_perdidas?: string[]
  gerado_em?: string
}

interface CrmContextoPayload {
  cliente_recorrente: boolean
  vendas_passadas: { servico: string; valor: number; data: string }[]
  notas: { texto: string; criado_em: string }[]
  tags: string[]
  followups_pendentes: { data: string; motivo: string | null }[]
}

function fmtMin(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
  const d = Math.floor(h / 24)
  const hr = h % 24
  return hr ? `${d}d ${hr}h` : `${d}d`
}

const TONE_ICON: Record<string, string> = {
  success: '✓',
  warning: '⚠',
  danger:  '⛔',
  info:    'ℹ',
}

const TAG_CLASS: Record<NonNullable<CoachResult['tag_sugerida']>, string> = {
  quente: styles.tagQuente,
  morno:  styles.tagMorno,
  frio:   styles.tagFrio,
}

function scoreToneClass(score: number): string {
  if (score >= 75) return styles.scoreQuente
  if (score >= 45) return styles.scoreMorno
  return styles.scoreFrio
}

export interface InboxCoachPanelProps {
  thread: WhatsAppThreadReal
  msgs: WhatsAppMsgReal[]
  onUseSuggestion: (texto: string) => void
}

export default function InboxCoachPanel({ thread, msgs, onUseSuggestion }: InboxCoachPanelProps) {
  const { brain } = useAiBrain()
  const [result, setResult] = useState<CoachResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function montarCrmContexto(threadId: string): Promise<CrmContextoPayload> {
    // Puxa em paralelo; se algum falhar, trata como vazio (coach degrada bem).
    const [notas, tags, vendas, followups] = await Promise.all([
      crmRepo.listarNotas(threadId).catch(() => []),
      crmRepo.tagsDaThread(threadId).catch(() => []),
      crmRepo.listarVendas(threadId).catch(() => []),
      crmRepo.followupsDaThread(threadId).catch(() => []),
    ])
    return {
      cliente_recorrente: vendas.length > 0,
      vendas_passadas: vendas.slice(0, 5).map((v) => ({
        servico: v.servico,
        valor: v.valor_cents,
        data: v.data,
      })),
      notas: notas.slice(0, 5).map((n) => ({
        texto: n.texto,
        criado_em: n.criado_em,
      })),
      tags: tags.map((t) => t.nome),
      followups_pendentes: followups
        .filter((f) => !f.feito)
        .slice(0, 3)
        .map((f) => ({ data: f.data, motivo: f.motivo })),
    }
  }

  async function analisar() {
    setRunning(true)
    setError(null)
    setCopied(false)
    try {
      const crm_contexto = await montarCrmContexto(thread.id)
      const body = {
        thread: {
          contato_nome: thread.contato_nome,
          contato_phone: thread.contato_phone,
          status: thread.status,
          origem: thread.origem,
        },
        msgs: msgs.map((m) => ({ autor: m.autor, texto: m.texto, hora: m.hora })),
        brain,
        crm_contexto,
      }
      const { data, error: fnError } = await supabase.functions.invoke<CoachResult>(
        'gemini-inbox-coach',
        { body },
      )
      if (fnError) {
        setError('IA indisponível agora. Tenta de novo em alguns segundos.')
        return
      }
      if (!data || (!data.proxima_resposta && !data.analise?.length)) {
        setError('A IA não conseguiu gerar sugestões pra essa conversa.')
        return
      }
      setResult(data)
    } catch {
      setError('Falha ao chamar a IA.')
    } finally {
      setRunning(false)
    }
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignora — a UI segue, atendente pode selecionar manualmente.
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h3 className={styles.title}>
          <span className={styles.titleIcon}>AI</span>
          Coach de conversão
        </h3>
        <button
          type="button"
          className={`${styles.btn} ${result ? styles.btnGhost : ''}`}
          onClick={analisar}
          disabled={running}
        >
          {running ? '...' : result ? '↻ Reanalisar' : 'Analisar'}
        </button>
      </div>

      {running && (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          IA lendo a conversa...
        </div>
      )}

      {error && <div className={styles.err}>{error}</div>}

      {!result && !running && !error && (
        <div className={styles.empty}>
          Clique no botão <span className={styles.cta}>Analisar</span> acima e a IA sugere a próxima resposta pra aumentar a chance de conversão.
        </div>
      )}

      {result && (
        <>
          {(result.score_lead !== undefined || result.tag_sugerida || result.nao_comercial || result.gerado_em) && (
            <div className={styles.metaRow}>
              {result.score_lead !== undefined && (
                <span className={`${styles.score} ${scoreToneClass(result.score_lead)}`}>
                  <span className={styles.scoreLabel}>score</span>
                  <span className={styles.scoreValue}>{result.score_lead}</span>
                </span>
              )}
              {result.tag_sugerida && (
                <span className={`${styles.tag} ${TAG_CLASS[result.tag_sugerida]}`}>
                  {result.tag_sugerida}
                </span>
              )}
              {result.nao_comercial && (
                <span className={styles.badgeNaoComercial}>não é cliente</span>
              )}
              {result.gerado_em && (
                <span className={styles.timestamp}>
                  {new Date(result.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}

          {result.resumo && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Resumo</h4>
              <p className={styles.resumo}>{result.resumo}</p>
            </div>
          )}

          {!!result.sinais_de_compra?.length && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Sinais de compra</h4>
              <ul className={`${styles.list} ${styles.listSinais}`}>
                {result.sinais_de_compra.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {!!result.objecoes_abertas?.length && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Objeções abertas</h4>
              <ul className={`${styles.list} ${styles.listObjecoes}`}>
                {result.objecoes_abertas.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}

          {result.analise_tempo && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Análise de tempo</h4>
              <div className={styles.tempoBox}>
                <div className={styles.tempoStats}>
                  <div className={styles.tempoStat}>
                    <span className={styles.tempoLabel}>Gap médio</span>
                    <span className={styles.tempoValue}>{fmtMin(result.analise_tempo.gap_medio_min)}</span>
                  </div>
                  <div className={styles.tempoStat}>
                    <span className={styles.tempoLabel}>Pior gap</span>
                    <span className={styles.tempoValue}>{fmtMin(result.analise_tempo.pior_gap_min)}</span>
                  </div>
                  <div className={styles.tempoStat}>
                    <span className={styles.tempoLabel}>Parada atual</span>
                    <span className={styles.tempoValue}>{fmtMin(result.analise_tempo.inatividade_atual_min)}</span>
                  </div>
                  <div className={styles.tempoStat}>
                    <span className={styles.tempoLabel}>Janela</span>
                    <span className={styles.tempoValue}>{result.analise_tempo.janela_dominante || '—'}</span>
                  </div>
                </div>
                {result.analise_tempo.comentario && (
                  <p className={styles.tempoComentario}>{result.analise_tempo.comentario}</p>
                )}
              </div>
            </div>
          )}

          {result.proxima_resposta && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>
                {result.reativacao_necessaria ? 'Mensagem de reativação' : 'Próxima resposta sugerida'}
                {result.reativacao_necessaria && (
                  <span className={styles.reativacaoBadge}>reativação</span>
                )}
              </h4>
              <div className={`${styles.suggestionBox} ${result.reativacao_necessaria ? styles.suggestionBoxReativacao : ''}`}>
                <p className={styles.suggestionText}>{result.proxima_resposta}</p>
                <div className={styles.suggestionActions}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => onUseSuggestion(result.proxima_resposta!)}
                  >
                    Usar essa resposta
                  </button>
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => copiar(result.proxima_resposta!)}
                  >
                    {copied ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!!result.proximos_passos?.length && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Próximos passos</h4>
              <ol className={styles.listOrdered}>
                {result.proximos_passos.map((p, i) => <li key={i}>{p}</li>)}
              </ol>
            </div>
          )}

          {!!result.analise?.length && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Análise</h4>
              {result.analise.map((ins, i) => (
                <div key={i} className={`${styles.insight} ${styles[`tone${cap(ins.tone)}`]}`}>
                  <span className={styles.insightIcon}>{TONE_ICON[ins.tone] || 'ℹ'}</span>
                  <div className={styles.insightBody}>
                    <span className={styles.insightTitle}>{ins.title}</span>
                    <span className={styles.insightText}>{ins.body}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!!result.oportunidades_perdidas?.length && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Oportunidades perdidas</h4>
              <ul className={styles.list}>
                {result.oportunidades_perdidas.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
