import { useState, useMemo } from 'react'
import { useWhatsAppDisparos } from '../hooks/useWhatsAppDisparos'
import type { WhatsAppConversa, WhatsAppDisparoRecipient } from '../api/types'
import styles from './DisparoMassa.module.css'

type Publico = 'leads' | 'agendados' | 'todos' | 'colar'

interface Props {
  conversas: WhatsAppConversa[]
}

const PUBLICO_LABEL: Record<Publico, string> = {
  leads: 'Apenas leads',
  agendados: 'Apenas agendados',
  todos: 'Todas as conversas',
  colar: 'Colar lista de números',
}

export default function DisparoMassa({ conversas }: Props) {
  const { historico, ultimoResultado, enviando, erro, disparar } = useWhatsAppDisparos()

  const [publico, setPublico] = useState<Publico>('leads')
  const [colado, setColado] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [language, setLanguage] = useState('pt_BR')
  const [varsRaw, setVarsRaw] = useState('')
  const [confirmar, setConfirmar] = useState(false)

  const variables = useMemo(
    () => varsRaw.split('|').map(s => s.trim()).filter(Boolean),
    [varsRaw],
  )

  const destinatarios: WhatsAppDisparoRecipient[] = useMemo(() => {
    if (publico === 'colar') {
      return parsePhones(colado).map(phone => ({ phone }))
    }
    let filtradas = conversas
    if (publico === 'leads')     filtradas = conversas.filter(c => c.status === 'lead')
    if (publico === 'agendados') filtradas = conversas.filter(c => c.status === 'agendado')
    return filtradas
      .filter(c => !!c.telefone)
      .map(c => ({
        phone: (c.telefone || '').replace(/\D/g, ''),
        params: variables.length ? [c.nome, ...variables.slice(1)] : undefined,
      }))
  }, [publico, colado, conversas, variables])

  const validos = destinatarios.filter(r => r.phone.length >= 10)

  const podeDisparar = templateName.trim().length > 0 && validos.length > 0 && !enviando

  async function onDisparar() {
    if (!podeDisparar) return
    if (!confirmar) { setConfirmar(true); return }
    await disparar({
      template_name: templateName.trim(),
      language,
      variables,
      recipients: validos,
    })
    setConfirmar(false)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        {/* coluna 1: público */}
        <section className={styles.card}>
          <h3 className={styles.title}>1. Público</h3>
          <div className={styles.chips}>
            {(['leads','agendados','todos','colar'] as Publico[]).map(p => (
              <button
                key={p}
                type="button"
                className={`${styles.chip} ${publico === p ? styles.chipOn : ''}`}
                onClick={() => { setPublico(p); setConfirmar(false) }}
              >
                {PUBLICO_LABEL[p]}
              </button>
            ))}
          </div>
          {publico === 'colar' ? (
            <textarea
              className={styles.textarea}
              rows={6}
              placeholder="Cole um número por linha. Ex: 5511984321100"
              value={colado}
              onChange={e => { setColado(e.target.value); setConfirmar(false) }}
            />
          ) : (
            <p className={styles.hint}>
              Selecionados a partir das conversas recentes. Números sem DDI são ignorados.
            </p>
          )}
          <div className={styles.count}>
            <span className={styles.countNum}>{validos.length}</span>
            <span className={styles.countLabel}>destinatários válidos</span>
          </div>
        </section>

        {/* coluna 2: template */}
        <section className={styles.card}>
          <h3 className={styles.title}>2. Template HSM</h3>
          <label className={styles.label}>Nome do template (aprovado na Meta)</label>
          <input
            className={styles.input}
            placeholder="ex: boas_vindas"
            value={templateName}
            onChange={e => { setTemplateName(e.target.value); setConfirmar(false) }}
          />
          <label className={styles.label}>Idioma</label>
          <input
            className={styles.input}
            placeholder="pt_BR"
            value={language}
            onChange={e => setLanguage(e.target.value)}
          />
          <label className={styles.label}>Variáveis do corpo (separadas por <code>|</code>)</label>
          <input
            className={styles.input}
            placeholder="ex: Marina | sábado às 14h"
            value={varsRaw}
            onChange={e => setVarsRaw(e.target.value)}
          />
          <p className={styles.hint}>
            Use <code>|</code> entre as variáveis. Pra públicos filtrados, a 1ª variável é
            substituída automaticamente pelo nome de cada contato.
          </p>
        </section>

        {/* coluna 3: preview + ação */}
        <section className={styles.card}>
          <h3 className={styles.title}>3. Preview & disparo</h3>
          <div className={styles.preview}>
            <span className={styles.pvLabel}>Template</span>
            <span className={styles.pvValue}>{templateName || '—'}</span>
            <span className={styles.pvLabel}>Idioma</span>
            <span className={styles.pvValue}>{language}</span>
            <span className={styles.pvLabel}>Variáveis</span>
            <span className={styles.pvValue}>{variables.length ? variables.join(' · ') : '—'}</span>
            <span className={styles.pvLabel}>Destinatários</span>
            <span className={styles.pvValue}>{validos.length}</span>
          </div>

          {confirmar && (
            <div className={styles.confirm}>
              Confirmar envio para <strong>{validos.length}</strong> número(s)? Esta ação consome
              créditos da Meta.
            </div>
          )}

          <button
            type="button"
            className={`${styles.btn} ${confirmar ? styles.btnConfirm : ''}`}
            disabled={!podeDisparar}
            onClick={onDisparar}
          >
            {enviando ? 'Disparando...' : confirmar ? `Confirmar e disparar (${validos.length})` : 'Disparar'}
          </button>

          {erro && <div className={styles.error}>Erro: {erro}</div>}

          {ultimoResultado && (
            <div className={styles.result}>
              <div className={styles.resultHead}>
                {ultimoResultado.sem_config ? 'Modo simulação' : 'Disparo concluído'}
              </div>
              <div className={styles.resultGrid}>
                <span>Total</span><strong>{ultimoResultado.total}</strong>
                <span>Enviados</span><strong className={styles.ok}>{ultimoResultado.enviados}</strong>
                <span>Falhas</span><strong className={styles.fail}>{ultimoResultado.falhas}</strong>
              </div>
              {ultimoResultado.sem_config && (
                <p className={styles.hint}>
                  Nenhuma mensagem foi enviada de verdade — configure <code>WHATSAPP_TOKEN</code> e{' '}
                  <code>WHATSAPP_PHONE_NUMBER_ID</code> nos secrets da edge function.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <section className={styles.history}>
        <h3 className={styles.title}>Histórico</h3>
        {historico.length === 0 ? (
          <p className={styles.hint}>Nenhum disparo registrado ainda.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Template</th>
                <th>Idioma</th>
                <th>Total</th>
                <th>Enviados</th>
                <th>Falhas</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {historico.map(h => (
                <tr key={h.id}>
                  <td>{fmtData(h.criado_em)}</td>
                  <td>{h.template_name}</td>
                  <td>{h.template_lang}</td>
                  <td>{h.total}</td>
                  <td className={styles.ok}>{h.enviados}</td>
                  <td className={h.falhas > 0 ? styles.fail : ''}>{h.falhas}</td>
                  <td>
                    <span className={`${styles.statusTag} ${styles['s_' + h.status]}`}>
                      {h.status === 'concluido' ? 'Concluído' : h.status === 'erro' ? 'Erro' : 'Em andamento'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function parsePhones(raw: string): string[] {
  return raw
    .split(/[\n,;]/)
    .map(s => s.replace(/\D/g, ''))
    .filter(p => p.length >= 10)
}

function fmtData(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}
