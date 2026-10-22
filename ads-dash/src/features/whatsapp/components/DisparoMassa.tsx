import { useState, useMemo } from 'react'
import { useWhatsAppDisparos } from '../hooks/useWhatsAppDisparos'
import { useWhatsAppInboxes } from '../hooks/useWhatsAppInboxes'
import { normalizarPhoneBR, formatarPhoneBR } from '../lib/phone'
import type { WhatsAppConversa, WhatsAppDisparoRecipient } from '../api/types'
import styles from './DisparoMassa.module.css'

// Regra BR válida: 12 (fixo) ou 13 (celular) dígitos canônicos iniciando em 55.
// Exclui LIDs, grupos (JID), IDs de automação e qualquer outro formato.
function isValidBrPhoneCanon(canon: string): boolean {
  if (!canon.startsWith('55')) return false
  return canon.length === 12 || canon.length === 13
}

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
  const { inboxes } = useWhatsAppInboxes()
  const selfSet = useMemo(
    () => new Set(inboxes.map((i) => normalizarPhoneBR(i.inbox_phone))),
    [inboxes],
  )

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
        phone: normalizarPhoneBR(c.telefone || ''),
        params: [c.nome, ...variables.slice(1)],
      }))
  }, [publico, colado, conversas, variables])

  // Rejeita LIDs, grupos, IDs sintéticos e os próprios números do salão.
  const validos = destinatarios.filter((r) => {
    if (!isValidBrPhoneCanon(r.phone)) return false
    if (selfSet.has(r.phone)) return false
    return true
  })
  const rejeitados = destinatarios.length - validos.length

  // Preview SEMPRE usa um nome exemplo quando a lista está vazia — evita
  // o bug "Oi ! Aqui é..." com {{1}} vazio. Em modo "colar", {{1}} não é
  // substituído por nome; marcamos isso no preview.
  const previewParams =
    publico === 'colar'
      ? ['[nome]', ...variables.slice(1)]
      : validos[0]?.params || ['[nome]', ...variables.slice(1)]
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
              placeholder="Cole um número por linha. Ex: 5531984321100"
              value={colado}
              onChange={e => { setColado(e.target.value); setConfirmar(false) }}
            />
          ) : (
            <p className={styles.hint}>
              Selecionados a partir das conversas recentes. Só números no formato BR válido
              (55 + DDD + celular) são aceitos — LIDs e seus próprios números são excluídos.
            </p>
          )}
          <div className={styles.count}>
            <span className={styles.countNum}>{validos.length}</span>
            <span className={styles.countLabel}>destinatários válidos</span>
          </div>
          {rejeitados > 0 && (
            <p className={styles.hint}>
              {rejeitados} número{rejeitados > 1 ? 's' : ''} rejeitado{rejeitados > 1 ? 's' : ''}
              {' '}(LID, número do próprio inbox ou formato inválido).
            </p>
          )}
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
          <label className={styles.label}>
            Variáveis padrão (separadas pelo caractere pipe <strong>|</strong>)
          </label>
          <input
            className={styles.input}
            placeholder="ex: cliente | sábado às 14h"
            value={varsRaw}
            onChange={e => setVarsRaw(e.target.value)}
          />
          <p className={styles.hint}>
            Use <code>{'{{1}}'}</code>, <code>{'{{2}}'}</code>… na mensagem.
            Em públicos filtrados, <code>{'{{1}}'}</code> vira o nome de cada contato automaticamente.
            Em modo "colar", preencha a 1ª variável aqui ou a mensagem vai sair com <code>[nome]</code>.
          </p>
          <p className={styles.hint}>
            <strong>Compliance:</strong> inclua instrução de opt-out ("responda SAIR pra não receber mais")
            e evite enviar fora da janela de 24h sem template aprovado — isso bloqueia o número.
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
              Confirmar envio para <strong>{validos.length}</strong> número{validos.length > 1 ? 's' : ''} via Z-API?
              {validos.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>
                  Primeiros 3: {validos.slice(0, 3).map((r) => formatarPhoneBR(r.phone)).join(' · ')}
                  {validos.length > 3 && ` · +${validos.length - 3} outros`}
                </div>
              )}
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
