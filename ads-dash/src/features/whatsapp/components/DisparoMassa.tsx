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

const EXEMPLO_MSG =
  'Oi {{1}}! Aqui é do The Blonde Concept ✨ Temos horários disponíveis essa semana — quer dar uma olhada?'

export default function DisparoMassa({ conversas }: Props) {
  const { historico, ultimoResultado, enviando, erro, disparar } = useWhatsAppDisparos()

  const [publico, setPublico] = useState<Publico>('leads')
  const [colado, setColado] = useState('')
  const [rotulo, setRotulo] = useState('')
  const [mensagem, setMensagem] = useState('')
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
        params: [c.nome, ...variables.slice(1)],
      }))
  }, [publico, colado, conversas, variables])

  const validos = destinatarios.filter(r => r.phone.length >= 10)

  const previewParams = validos[0]?.params || variables
  const previewMsg = aplicarVars(mensagem || EXEMPLO_MSG, previewParams)

  const podeDisparar =
    rotulo.trim().length > 0 &&
    mensagem.trim().length > 0 &&
    validos.length > 0 &&
    !enviando

  async function onDisparar() {
    if (!podeDisparar) return
    if (!confirmar) { setConfirmar(true); return }
    await disparar({
      rotulo: rotulo.trim(),
      mensagem: mensagem.trim(),
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

        {/* coluna 2: mensagem */}
        <section className={styles.card}>
          <h3 className={styles.title}>2. Mensagem</h3>
          <label className={styles.label}>Rótulo do disparo (identificador interno)</label>
          <input
            className={styles.input}
            placeholder="ex: promo-junho"
            value={rotulo}
            onChange={e => { setRotulo(e.target.value); setConfirmar(false) }}
          />
          <label className={styles.label}>Texto da mensagem</label>
          <textarea
            className={styles.textarea}
            rows={5}
            placeholder={EXEMPLO_MSG}
            value={mensagem}
            onChange={e => { setMensagem(e.target.value); setConfirmar(false) }}
          />
          <label className={styles.label}>Variáveis padrão (separadas por <code>|</code>)</label>
          <input
            className={styles.input}
            placeholder="ex: cliente | sábado às 14h"
            value={varsRaw}
            onChange={e => setVarsRaw(e.target.value)}
          />
          <p className={styles.hint}>
            Use <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>… na mensagem.
            Pra públicos filtrados, <code>{'{{1}}'}</code> vira o nome de cada contato automaticamente.
          </p>
        </section>

        {/* coluna 3: preview + ação */}
        <section className={styles.card}>
          <h3 className={styles.title}>3. Preview & disparo</h3>
          <div className={styles.preview}>
            <span className={styles.pvLabel}>Rótulo</span>
            <span className={styles.pvValue}>{rotulo || '—'}</span>
            <span className={styles.pvLabel}>Destinatários</span>
            <span className={styles.pvValue}>{validos.length}</span>
            <span className={styles.pvLabel}>Preview</span>
            <span className={styles.pvValue} style={{ whiteSpace: 'pre-wrap' }}>{previewMsg || '—'}</span>
          </div>

          {confirmar && (
            <div className={styles.confirm}>
              Confirmar envio para <strong>{validos.length}</strong> número(s) via Z-API?
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
                  Nenhuma mensagem foi enviada — configure <code>ZAPI_INSTANCE_ID</code>,{' '}
                  <code>ZAPI_TOKEN</code> e <code>ZAPI_CLIENT_TOKEN</code> nos secrets.
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
                <th>Rótulo</th>
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

function aplicarVars(template: string, params: string[]): string {
  return template.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
    const i = Number(idx) - 1
    return params[i] != null ? String(params[i]) : ''
  })
}

function fmtData(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}
