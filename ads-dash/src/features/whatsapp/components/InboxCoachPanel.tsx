import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { useAiBrain } from '@/features/ai'
import type { WhatsAppThreadReal, WhatsAppMsgReal } from '../api/types'
import styles from './InboxCoachPanel.module.css'

interface InsightItem {
  tone: 'success' | 'warning' | 'danger' | 'info'
  title: string
  body: string
}

interface CoachResult {
  modelo?: string
  resumo?: string
  tag_sugerida?: 'quente' | 'morno' | 'frio'
  proxima_resposta?: string
  analise?: InsightItem[]
  oportunidades_perdidas?: string[]
  gerado_em?: string
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

  async function analisar() {
    setRunning(true)
    setError(null)
    try {
      const body = {
        thread: {
          contato_nome: thread.contato_nome,
          contato_phone: thread.contato_phone,
          status: thread.status,
          origem: thread.origem,
        },
        msgs: msgs.map((m) => ({ autor: m.autor, texto: m.texto, hora: m.hora })),
        brain,
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
          Clique em <strong>Analisar</strong> e a IA sugere a próxima resposta pra aumentar a chance de conversão.
        </div>
      )}

      {result && (
        <>
          {(result.tag_sugerida || result.gerado_em) && (
            <div className={styles.metaRow}>
              {result.tag_sugerida && (
                <span className={`${styles.tag} ${TAG_CLASS[result.tag_sugerida]}`}>
                  {result.tag_sugerida}
                </span>
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

          {result.proxima_resposta && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Próxima resposta sugerida</h4>
              <div className={styles.suggestionBox}>
                <p className={styles.suggestionText}>{result.proxima_resposta}</p>
                <div className={styles.suggestionActions}>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => onUseSuggestion(result.proxima_resposta!)}
                  >
                    Usar essa resposta
                  </button>
                </div>
              </div>
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
