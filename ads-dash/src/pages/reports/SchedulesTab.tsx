import { useState } from 'react'
import { useReportSchedules } from '@/features/reports'
import { useToast } from '@/app/providers/ToastContext'
import styles from './SchedulesTab.module.css'

const METRICS_OPTIONS = [
  { key: 'roas',          label: 'ROAS' },
  { key: 'roi',           label: 'ROI' },
  { key: 'ctr',           label: 'CTR' },
  { key: 'mensagens',     label: 'Mensagens' },
  { key: 'agendamentos',  label: 'Agendamentos' },
  { key: 'vendas',        label: 'Vendas' },
  { key: 'investimento',  label: 'Investimento' },
  { key: 'receita',       label: 'Receita' },
  { key: 'campanhas',     label: 'Campanhas' },
  { key: 'funil',         label: 'Funil' },
]

const PERIODICIDADES = [
  { key: 'diario',  label: 'Diário'  },
  { key: 'semanal', label: 'Semanal' },
  { key: 'mensal',  label: 'Mensal'  },
]

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

function emailValid(e) { return /\S+@\S+\.\S+/.test(e) }

const PERIODICIDADE_LABEL = { diario: 'Diário', semanal: 'Semanal', mensal: 'Mensal' }

export default function SchedulesTab() {
  const { schedules, loading, usingLocal, add, remove, toggleActive, sendNow } = useReportSchedules()
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(null)
  const toast = useToast()

  const [form, setForm] = useState({
    nome: 'Relatório semanal',
    canalEmail: true,
    canalWhatsapp: false,
    destinatariosRaw: '',
    whatsappRaw: '',
    periodicidade: 'semanal',
    hora_envio: '08:00',
    dia_semana: 1,
    dia_mes: 1,
    formato: 'pdf',
    metricas: ['roas','ctr','mensagens','vendas','campanhas'],
    periodo_dados: 'semana',
  })

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleMetric(k) {
    setForm(f => ({
      ...f,
      metricas: f.metricas.includes(k) ? f.metricas.filter(x => x !== k) : [...f.metricas, k]
    }))
  }

  async function handleAdd() {
    const emails = form.destinatariosRaw
      .split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
    const numeros = form.whatsappRaw
      .split(/[,;\s]+/).map(s => s.replace(/\D/g, '')).filter(Boolean)

    const canais = []
    if (form.canalEmail)    canais.push('email')
    if (form.canalWhatsapp) canais.push('whatsapp')

    if (!form.nome.trim()) { toast.error('Dê um nome ao agendamento.'); return }
    if (!canais.length) { toast.error('Escolha pelo menos um canal de envio.'); return }
    if (form.canalEmail && (!emails.length || emails.some(e => !emailValid(e)))) {
      toast.error('Informe pelo menos um e-mail válido (separe por vírgula).'); return
    }
    if (form.canalWhatsapp && numeros.some(n => n.length < 12)) {
      toast.error('Números de WhatsApp devem ter DDI+DDD+número (ex: 5531999998888).'); return
    }
    if (form.canalWhatsapp && !numeros.length) {
      toast.error('Informe pelo menos um número de WhatsApp.'); return
    }
    if (!form.metricas.length) { toast.error('Selecione ao menos uma métrica.'); return }

    const { error } = await add({
      nome: form.nome.trim(),
      canais,
      destinatarios: form.canalEmail ? emails : [],
      whatsapp: form.canalWhatsapp ? numeros : [],
      periodicidade: form.periodicidade as never,
      hora_envio: form.hora_envio,
      dia_semana: form.periodicidade === 'semanal' ? form.dia_semana : null,
      dia_mes: form.periodicidade === 'mensal' ? form.dia_mes : null,
      formato: form.formato as never,
      metricas: form.metricas,
      periodo_dados: form.periodo_dados as never,
      ativo: true,
    })

    if (error) {
      toast.error('Erro: ' + (error.message || 'verifique a tabela report_schedules.'))
    } else {
      toast.success('Agendamento criado!')
      setShowForm(false)
      setForm(f => ({ ...f, destinatariosRaw: '', whatsappRaw: '' }))
    }
  }

  async function handleSendNow(id) {
    setBusy(id)
    const res = await sendNow(id)
    setBusy(null)
    if (res.ok) toast.success(res.msg, { title: 'E-mail enviado' })
    else        toast.error(res.msg, { title: 'Falha no envio' })
  }

  function describeFreq(s) {
    if (s.periodicidade === 'diario')  return `Todo dia às ${s.hora_envio}`
    if (s.periodicidade === 'semanal') return `Toda ${DIAS_SEMANA[s.dia_semana ?? 1]}-feira às ${s.hora_envio}`
    if (s.periodicidade === 'mensal')  return `Todo dia ${s.dia_mes ?? 1} às ${s.hora_envio}`
    return ''
  }

  return (
    <div>
      {usingLocal && (
        <div className={styles.warnBanner}>
          ⚠ Modo local — agendamentos só salvam no navegador. Para envio real configure Supabase + Edge Function <code>send-report</code> (ver README).
        </div>
      )}

      <div className={styles.headerRow}>
        <div>
          <p className={styles.intro}>Receba relatórios automaticamente no e-mail. A função <code>send-report</code> roda no Supabase a cada 15 min e dispara os agendamentos da fila.</p>
        </div>
        <button className={styles.newBtn} onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancelar' : '+ Novo agendamento'}
        </button>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <div className={styles.formGrid}>
            <Field label="Nome do agendamento" full>
              <input className={styles.input} value={form.nome} onChange={e => setField('nome', e.target.value)} />
            </Field>

            <Field label="Canais de envio" full>
              <div className={styles.channelRow}>
                <label className={`${styles.channelChip} ${form.canalEmail ? styles.channelOn : ''}`}>
                  <input type="checkbox" checked={form.canalEmail} onChange={e => setField('canalEmail', e.target.checked)} />
                  ✉ E-mail
                </label>
                <label className={`${styles.channelChip} ${form.canalWhatsapp ? styles.channelOn : ''}`}>
                  <input type="checkbox" checked={form.canalWhatsapp} onChange={e => setField('canalWhatsapp', e.target.checked)} />
                  💬 WhatsApp
                </label>
              </div>
            </Field>

            {form.canalEmail && (
              <Field label="E-mails (separados por vírgula)" full>
                <input
                  className={styles.input}
                  value={form.destinatariosRaw}
                  onChange={e => setField('destinatariosRaw', e.target.value)}
                  placeholder="cliente@salao.com, gestor@salao.com"
                />
              </Field>
            )}

            {form.canalWhatsapp && (
              <Field label="Números WhatsApp (DDI+DDD+número, separados por vírgula)" full>
                <input
                  className={styles.input}
                  value={form.whatsappRaw}
                  onChange={e => setField('whatsappRaw', e.target.value)}
                  placeholder="5531999998888, 5531888887777"
                />
              </Field>
            )}

            <Field label="Periodicidade">
              <select className={styles.input} value={form.periodicidade} onChange={e => setField('periodicidade', e.target.value)}>
                {PERIODICIDADES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </Field>

            <Field label="Hora do envio">
              <input className={styles.input} type="time" value={form.hora_envio} onChange={e => setField('hora_envio', e.target.value)} />
            </Field>

            {form.periodicidade === 'semanal' && (
              <Field label="Dia da semana">
                <select className={styles.input} value={form.dia_semana} onChange={e => setField('dia_semana', parseInt(e.target.value))}>
                  {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}-feira</option>)}
                </select>
              </Field>
            )}

            {form.periodicidade === 'mensal' && (
              <Field label="Dia do mês (1–28)">
                <input className={styles.input} type="number" min={1} max={28} value={form.dia_mes} onChange={e => setField('dia_mes', parseInt(e.target.value) || 1)} />
              </Field>
            )}

            <Field label="Formato">
              <select className={styles.input} value={form.formato} onChange={e => setField('formato', e.target.value)}>
                <option value="pdf">PDF (HTML imprimível)</option>
                <option value="csv">Excel (CSV)</option>
              </select>
            </Field>

            <Field label="Período dos dados">
              <select className={styles.input} value={form.periodo_dados} onChange={e => setField('periodo_dados', e.target.value)}>
                <option value="hoje">Hoje</option>
                <option value="semana">Últimos 7 dias</option>
                <option value="mes">Últimos 30 dias</option>
              </select>
            </Field>

            <Field label="Métricas a incluir" full>
              <div className={styles.metricsGrid}>
                {METRICS_OPTIONS.map(m => (
                  <label key={m.key} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={form.metricas.includes(m.key)}
                      onChange={() => toggleMetric(m.key)}
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>

          <button className={styles.saveBtn} onClick={handleAdd}>Criar agendamento</button>
        </div>
      )}

      {loading ? (
        <div className={styles.empty}>Carregando agendamentos...</div>
      ) : schedules.length === 0 ? (
        <div className={styles.empty}>Nenhum agendamento cadastrado ainda.</div>
      ) : (
        <div className={styles.list}>
          {schedules.map(s => (
            <div key={s.id} className={`${styles.item} ${!s.ativo ? styles.itemOff : ''}`}>
              <div className={styles.itemMain}>
                <div className={styles.itemHead}>
                  <strong className={styles.itemName}>{s.nome}</strong>
                  <span className={styles.tag}>{PERIODICIDADE_LABEL[s.periodicidade]}</span>
                  <span className={styles.tagSoft}>{(s.formato || 'pdf').toUpperCase()}</span>
                  {(s.canais || ['email']).includes('email')    && <span className={styles.tagChannel}>✉ E-mail</span>}
                  {(s.canais || []).includes('whatsapp')         && <span className={styles.tagChannel}>💬 WhatsApp</span>}
                </div>
                <div className={styles.itemMeta}>
                  {describeFreq(s)} · período: {s.periodo_dados}
                </div>
                <div className={styles.itemEmails}>
                  {[...(s.destinatarios || []), ...(s.whatsapp || [])].join(', ') || '—'}
                </div>
              </div>

              <div className={styles.itemActions}>
                <label className={styles.toggle} title={s.ativo ? 'Desativar' : 'Ativar'}>
                  <input type="checkbox" checked={s.ativo} onChange={() => toggleActive(s.id)} />
                  <span className={styles.toggleSlider} />
                </label>
                <button
                  className={styles.actionBtn}
                  onClick={() => handleSendNow(s.id)}
                  disabled={busy === s.id}
                  title="Enviar agora"
                >
                  {busy === s.id ? '...' : '✉ Enviar'}
                </button>
                <button
                  className={styles.removeBtn}
                  onClick={() => remove(s.id)}
                  title="Remover"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, full = false, children }) {
  return (
    <div className={`${styles.field} ${full ? styles.fieldFull : ''}`}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}
