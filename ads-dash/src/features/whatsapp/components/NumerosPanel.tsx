import { useState } from 'react'
import { useWhatsAppNumbers } from '../hooks/useWhatsAppNumbers'
import type { WhatsAppNumber, WhatsAppNumberInput, WhatsAppProvider } from '../api/types'
import { formatarPhoneBR, normalizarPhoneBR } from '../lib/phone'

// Normalização branda pra números Meta Cloud API: aceita landline (12 dígitos)
// ou celular (13 dígitos com "9"). Não força inserção do "9" — landlines
// brasileiros usados via Cloud API têm 8 dígitos após o DDD.
function normalizarNumeroMeta(raw: string): string {
  let n = (raw || '').replace(/\D/g, '')
  if (!n) return ''
  if (n.length >= 11 && n[0] === '0') n = n.slice(1)
  if (n.length === 10 || n.length === 11) n = '55' + n
  return n
}

// Formata E.164 canônico pra leitura humana. Aceita landline (12 dígitos)
// e celular (13 dígitos). Fallback: retorna o input cru.
function formatarNumeroFlex(raw: string): string {
  const n = (raw || '').replace(/\D/g, '')
  if (n.length === 13 && n.startsWith('55')) {
    return `(${n.slice(2, 4)}) ${n.slice(4, 9)}-${n.slice(9)}`
  }
  if (n.length === 12 && n.startsWith('55')) {
    return `(${n.slice(2, 4)}) ${n.slice(4, 8)}-${n.slice(8)}`
  }
  return formatarPhoneBR(raw)
}
import styles from './NumerosPanel.module.css'

const PROVIDER_LABEL: Record<WhatsAppProvider, string> = {
  zapi: 'Z-API',
  meta_official: 'Meta Oficial',
}

export default function NumerosPanel() {
  const { numeros, loading, erro, salvar, remover, togglarAtivo, refresh } = useWhatsAppNumbers()
  const [editando, setEditando] = useState<WhatsAppNumber | null>(null)
  const [criando, setCriando] = useState(false)

  const abrirNovo = () => { setEditando(null); setCriando(true) }
  const abrirEdit = (n: WhatsAppNumber) => { setEditando(n); setCriando(true) }
  const fechar = () => { setCriando(false); setEditando(null) }

  async function handleSalvar(input: WhatsAppNumberInput) {
    await salvar(editando?.id ?? null, input)
    fechar()
  }

  async function handleRemover(n: WhatsAppNumber) {
    const ok = window.confirm(`Remover o número "${n.rotulo}" (${formatarNumeroFlex(n.display_number)})?`)
    if (!ok) return
    await remover(n.id)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.h2}>Números WhatsApp</h2>
          <p className={styles.subtitle}>
            Cadastre aqui os números que o salão usa. Cada linha define o provider (Z-API para os
            números atuais, Meta Oficial para os dedicados a disparo em massa) e vira opção nos
            disparos e nos relatórios.
          </p>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={abrirNovo}>
          + Adicionar número
        </button>
      </div>

      {erro && <div className={styles.error}>Erro ao carregar: {erro} <button type="button" className={styles.linkBtn} onClick={refresh}>tentar de novo</button></div>}

      {loading ? (
        <p className={styles.loading}>Carregando números...</p>
      ) : numeros.length === 0 ? (
        <EmptyState onNovo={abrirNovo} />
      ) : (
        <div className={styles.list}>
          {numeros.map(n => (
            <NumeroCard
              key={n.id}
              numero={n}
              onEditar={() => abrirEdit(n)}
              onRemover={() => handleRemover(n)}
              onToggleAtivo={() => togglarAtivo(n)}
            />
          ))}
        </div>
      )}

      {criando && (
        <NumeroModal
          numero={editando}
          onClose={fechar}
          onSalvar={handleSalvar}
        />
      )}
    </div>
  )
}

function NumeroCard({
  numero,
  onEditar,
  onRemover,
  onToggleAtivo,
}: {
  numero: WhatsAppNumber
  onEditar: () => void
  onRemover: () => void
  onToggleAtivo: () => void
}) {
  const providerLabel = PROVIDER_LABEL[numero.provider]
  const providerTone = numero.provider === 'meta_official' ? styles.providerOfficial : styles.providerZapi
  return (
    <div className={`${styles.card} ${!numero.ativo ? styles.cardMuted : ''}`}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}>
          <span className={`${styles.dot} ${numero.ativo ? styles.dotOn : styles.dotOff}`} aria-hidden />
          <div>
            <h3 className={styles.rotulo}>{numero.rotulo}</h3>
            <p className={styles.phone}>{formatarNumeroFlex(numero.display_number)}</p>
          </div>
        </div>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${providerTone}`}>{providerLabel}</span>
          <span className={`${styles.badge} ${numero.ativo ? styles.badgeAtivo : styles.badgePausado}`}>
            {numero.ativo ? 'ativo' : 'pausado'}
          </span>
        </div>
      </div>

      <dl className={styles.meta}>
        {numero.provider === 'meta_official' ? (
          <>
            <div><dt>phone_number_id</dt><dd>{numero.phone_number_id || '—'}</dd></div>
            <div><dt>waba_id</dt><dd>{numero.waba_id || 'usa META_WABA_ID'}</dd></div>
          </>
        ) : (
          <div><dt>Instance</dt><dd>{numero.zapi_instance_id || '—'}</dd></div>
        )}
      </dl>

      <div className={styles.cardActions}>
        <button type="button" className={styles.linkBtn} onClick={onEditar}>Editar</button>
        <button type="button" className={styles.linkBtn} onClick={onToggleAtivo}>
          {numero.ativo ? 'Pausar' : 'Ativar'}
        </button>
        <button type="button" className={`${styles.linkBtn} ${styles.danger}`} onClick={onRemover}>
          Remover
        </button>
      </div>
    </div>
  )
}

function EmptyState({ onNovo }: { onNovo: () => void }) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>Nenhum número cadastrado.</p>
      <p className={styles.emptyText}>
        Cadastre o primeiro número pra atender e disparar. Duas opções:
        <strong> Z-API</strong> (WhatsApp Web, o que já roda hoje) ou{' '}
        <strong>Meta Oficial</strong> (com templates aprovados, ideal pra disparo em massa sem risco de ban).
      </p>
      <button type="button" className={styles.btnPrimary} onClick={onNovo}>
        + Cadastrar primeiro número
      </button>
    </div>
  )
}

// ------------------------------------------------------------
// Modal de criação/edição
// ------------------------------------------------------------

interface ModalProps {
  numero: WhatsAppNumber | null
  onClose: () => void
  onSalvar: (input: WhatsAppNumberInput) => Promise<void>
}

function NumeroModal({ numero, onClose, onSalvar }: ModalProps) {
  const [rotulo, setRotulo]                   = useState(numero?.rotulo ?? '')
  const [displayNumber, setDisplayNumber]     = useState(numero?.display_number ?? '')
  const [provider, setProvider]               = useState<WhatsAppProvider>(numero?.provider ?? 'meta_official')
  const [phoneNumberId, setPhoneNumberId]     = useState(numero?.phone_number_id ?? '')
  const [wabaId, setWabaId]                   = useState(numero?.waba_id ?? '')
  const [zapiInstanceId, setZapiInstanceId]   = useState(numero?.zapi_instance_id ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Z-API só roda em celular (13 dígitos com "9"), então usa o normalizador padrão.
  // Meta Cloud API aceita landline (12 dígitos, sem "9") — nesse caso não força
  // inserção do "9", só garante DDI 55.
  const numeroNorm = provider === 'meta_official'
    ? normalizarNumeroMeta(displayNumber)
    : normalizarPhoneBR(displayNumber)
  const numeroValido = provider === 'meta_official'
    ? (numeroNorm.length === 12 || numeroNorm.length === 13) && numeroNorm.startsWith('55')
    : numeroNorm.length === 13 && numeroNorm.startsWith('55')
  const providerCamposOk =
    provider === 'zapi' ? zapiInstanceId.trim().length > 0
    : phoneNumberId.trim().length > 0
  const podeSalvar = rotulo.trim().length > 0 && numeroValido && providerCamposOk && !salvando

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar) return
    setSalvando(true)
    setErro(null)
    try {
      await onSalvar({
        rotulo: rotulo.trim(),
        display_number: numeroNorm,
        provider,
        phone_number_id: phoneNumberId.trim() || null,
        waba_id: wabaId.trim() || null,
        zapi_instance_id: zapiInstanceId.trim() || null,
        ativo: numero?.ativo ?? true,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <form className={styles.modal} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <header className={styles.modalHead}>
          <h3>{numero ? 'Editar número' : 'Adicionar número'}</h3>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className={styles.modalBody}>
          <label className={styles.field}>
            <span className={styles.label}>Rótulo interno *</span>
            <input
              className={styles.input}
              placeholder="ex: Marketing oficial"
              value={rotulo}
              onChange={e => setRotulo(e.target.value)}
              autoFocus
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Número (com DDI + DDD) *</span>
            <input
              className={styles.input}
              placeholder="ex: 5531999998888"
              value={displayNumber}
              onChange={e => setDisplayNumber(e.target.value)}
            />
            <span className={styles.hint}>
              {displayNumber
                ? (numeroValido
                    ? <>Formato canônico: <code>{numeroNorm}</code> · {formatarNumeroFlex(numeroNorm)}</>
                    : (provider === 'meta_official'
                        ? 'Número inválido — inclua DDI (55) + DDD + número (celular ou fixo).'
                        : 'Número inválido — Z-API só aceita celular com o "9" (55 DD 9XXXX XXXX).'))
                : (provider === 'meta_official'
                    ? 'Cloud API aceita celular (13 dígitos) ou fixo (12 dígitos).'
                    : 'Só celulares com "9". Sistema normaliza pra formato canônico 55DDXXXXXXXXX.')}
            </span>
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Provider *</span>
            <div className={styles.providerChoices}>
              <label className={`${styles.choice} ${provider === 'meta_official' ? styles.choiceOn : ''}`}>
                <input
                  type="radio"
                  name="provider"
                  value="meta_official"
                  checked={provider === 'meta_official'}
                  onChange={() => setProvider('meta_official')}
                />
                <span>
                  <strong>Meta Cloud API</strong>
                  <em>Oficial · exige templates aprovados fora da janela 24h</em>
                </span>
              </label>
              <label className={`${styles.choice} ${provider === 'zapi' ? styles.choiceOn : ''}`}>
                <input
                  type="radio"
                  name="provider"
                  value="zapi"
                  checked={provider === 'zapi'}
                  onChange={() => setProvider('zapi')}
                />
                <span>
                  <strong>Z-API</strong>
                  <em>WhatsApp Web · texto livre, sem template</em>
                </span>
              </label>
            </div>
          </div>

          {provider === 'meta_official' ? (
            <>
              <label className={styles.field}>
                <span className={styles.label}>phone_number_id *</span>
                <input
                  className={styles.input}
                  placeholder="ex: 442597845... (Meta Business)"
                  value={phoneNumberId}
                  onChange={e => setPhoneNumberId(e.target.value)}
                />
                <span className={styles.hint}>
                  Pega em Meta Business → WhatsApp → Configurações da API → seu número.
                </span>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>waba_id (opcional)</span>
                <input
                  className={styles.input}
                  placeholder="deixa vazio pra usar META_WABA_ID dos secrets"
                  value={wabaId}
                  onChange={e => setWabaId(e.target.value)}
                />
              </label>
              <div className={styles.info}>
                Token da Meta fica nos secrets do projeto (<code>META_WHATSAPP_TOKEN</code>). Só o
                <code>phone_number_id</code> vai por número aqui.
              </div>
            </>
          ) : (
            <>
              <label className={styles.field}>
                <span className={styles.label}>ZAPI_INSTANCE_ID *</span>
                <input
                  className={styles.input}
                  placeholder="ex: 3D1F..."
                  value={zapiInstanceId}
                  onChange={e => setZapiInstanceId(e.target.value)}
                />
              </label>
              <div className={styles.info}>
                <code>ZAPI_TOKEN</code> e <code>ZAPI_CLIENT_TOKEN</code> continuam nos secrets do projeto —
                não guardar aqui por segurança.
              </div>
            </>
          )}

          {erro && <div className={styles.error}>{erro}</div>}
        </div>

        <footer className={styles.modalFoot}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.btnPrimary} disabled={!podeSalvar}>
            {salvando ? 'Salvando...' : (numero ? 'Salvar alterações' : 'Adicionar')}
          </button>
        </footer>
      </form>
    </div>
  )
}
