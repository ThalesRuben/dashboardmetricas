import { useState, useRef, useEffect } from 'react'
import { useMetrics } from '@/features/ads/hooks/useMetrics'
import { useGoals } from '@/features/ads/hooks/useGoals'
import { useInstagramMetrics } from '@/features/organic/instagram/hooks/useInstagramMetrics'
import { answerQuestion, suggestionChips } from '@/lib/aiInsights'
import styles from './AiAssistant.module.css'

const STORAGE_KEY = 'ads-dash:ai-chat'
const MAX_HISTORY = 80
const INITIAL_MSG = { role: 'ai', text: 'Olá! Sou o assistente de mídia. Pergunte sobre suas métricas, campanhas ou peça um resumo.' }

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [INITIAL_MSG]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return [INITIAL_MSG]
    return parsed
  } catch { return [INITIAL_MSG] }
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(loadHistory)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)

  // persiste o histórico em localStorage (mantém últimos MAX_HISTORY)
  useEffect(() => {
    try {
      const slice = messages.slice(-MAX_HISTORY)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slice))
    } catch { /* quota / privado: ignora */ }
  }, [messages])

  function clearHistory() {
    setMessages([INITIAL_MSG])
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }
  const { data } = useMetrics('hoje')
  const { goals } = useGoals()
  const { data: ig } = useInstagramMetrics()
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, thinking, open])

  async function handleSend(text?: string) {
    const q = (text ?? input).trim()
    if (!q || thinking) return
    setMessages(m => [...m, { role: 'user', text: q }])
    setInput('')
    setThinking(true)
    await new Promise(r => setTimeout(r, 350 + Math.random() * 400))
    const reply = answerQuestion(q, data, goals, ig)
    setMessages(m => [...m, { role: 'ai', text: reply }])
    setThinking(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <button
        className={`${styles.fab} ${open ? styles.fabHidden : ''}`}
        onClick={() => setOpen(true)}
        title="Assistente de IA"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <span className={styles.fabPulse} />
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.head}>
            <div className={styles.headLeft}>
              <div className={styles.botIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2v4M5 8h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2z"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></svg>
              </div>
              <div>
                <div className={styles.title}>Assistente</div>
                <div className={styles.sub}>{messages.length - 1} mensagens · histórico salvo</div>
              </div>
            </div>
            <div className={styles.headBtns}>
              <button
                className={styles.closeBtn}
                onClick={clearHistory}
                title="Limpar histórico"
                aria-label="Limpar histórico"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18 M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
              </button>
              <button className={styles.closeBtn} onClick={() => setOpen(false)} title="Fechar">×</button>
            </div>
          </div>

          <div ref={scrollRef} className={styles.chat}>
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? styles.bubbleUser : styles.bubbleAi}>
                {m.text.split('\n').map((line, j) => (
                  <p key={j}>{renderLine(line)}</p>
                ))}
              </div>
            ))}
            {thinking && (
              <div className={styles.bubbleAi}>
                <span className={styles.dot}/><span className={styles.dot}/><span className={styles.dot}/>
              </div>
            )}
          </div>

          {messages.length <= 2 && (
            <div className={styles.chips}>
              {suggestionChips(ig).map(s => (
                <button key={s} className={styles.chip} onClick={() => handleSend(s)}>{s}</button>
              ))}
            </div>
          )}

          <div className={styles.inputRow}>
            <textarea
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pergunte algo sobre suas métricas..."
              rows={1}
            />
            <button
              className={styles.sendBtn}
              onClick={() => handleSend()}
              disabled={!input.trim() || thinking}
              title="Enviar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// Renderiza markdown leve (apenas **bold**) como React nodes — sem dangerouslySetInnerHTML.
// React escapa o texto automaticamente, então não há risco de XSS.
function renderLine(line) {
  if (!line) return ' '
  const parts = line.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}
