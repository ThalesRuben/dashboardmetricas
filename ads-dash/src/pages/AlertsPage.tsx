import { useMemo, useState } from 'react'
import { useGoals } from '@/features/ads/hooks/useGoals'
import { useMetrics } from '@/features/ads/hooks/useMetrics'
import { useAlerts, formatAlertTime } from '@/features/alerts'
import { useToast } from '@/app/providers/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import { fmtNumber, fmtRoas, fmtPct } from '@/shared/lib/format'
import styles from './AlertsPage.module.css'

export default function AlertsPage() {
  const { goals, loading: goalsLoading, updateGoal } = useGoals()
  const { alerts, loading: alertsLoading } = useAlerts()
  const { data: today } = useMetrics('hoje')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail]       = useState('')
  const toast = useToast()

  const statuses = useMemo(
    () => (goals || []).filter(g => g.enabled).map(g => buildStatus(g, today)),
    [goals, today],
  )

  function handleSave() {
    toast.info('Persistência ainda não conectada — os canais ficam só no estado local.', {
      title: 'Em breve'
    })
  }

  const typeStyle = {
    danger:  { bg:'var(--color-danger-bg)',  color:'var(--color-danger)',  icon:'⛔' },
    warning: { bg:'var(--color-warning-bg)', color:'var(--color-warning)', icon:'⚠️' },
    success: { bg:'var(--color-success-bg)', color:'var(--color-success)', icon:'✓' },
    info:    { bg:'var(--accent-tint)',      color:'var(--accent)',        icon:'ℹ️' },
  }

  return (
    <div className={styles.page}>
      <PageHeader
        section="alerts"
        title="Metas e alertas"
        subtitle="O que você quer atingir, e quando quer ser avisado"
      />

      <div className={styles.grid}>
        {/* Metas */}
        <div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Metas e limites</h2>
            {goalsLoading ? (
              <div className={styles.loading}>Carregando metas...</div>
            ) : (
              <div className={styles.goalsList}>
                {goals.map(g => (
                  <div key={g.key} className={`${styles.goalRow} ${!g.enabled ? styles.goalDisabled : ''}`}>
                    <div className={styles.goalLeft}>
                      <label className={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={g.enabled}
                          onChange={e => updateGoal(g.key, { enabled: e.target.checked })}
                          className={styles.toggleInput}
                        />
                        <span className={styles.toggleSlider} />
                      </label>
                      <span className={styles.goalLabel}>{g.label}</span>
                    </div>
                    <div className={styles.goalRight}>
                      <input
                        type="number"
                        value={g.value}
                        onChange={e => updateGoal(g.key, { value: parseFloat(e.target.value) || 0 })}
                        className={styles.goalInput}
                        disabled={!g.enabled}
                      />
                      <span className={styles.goalUnit}>{g.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notificações */}
          <div className={styles.card} style={{ marginTop: 14 }}>
            <h2 className={styles.cardTitle}>Canais de notificação</h2>

            <div className={styles.channelRow}>
              <div className={styles.channelIcon} style={{ background:'#E6F1FB' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <div className={styles.channelInfo}>
                <label className={styles.channelLabel}>E-mail</label>
                <input
                  className={styles.channelInput}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className={styles.channelRow}>
              <div className={styles.channelIcon} style={{ background:'#EAF3DE' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#27500A" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              </div>
              <div className={styles.channelInfo}>
                <label className={styles.channelLabel}>WhatsApp</label>
                <input
                  className={styles.channelInput}
                  type="tel"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="+55 31 99999-9999"
                />
              </div>
            </div>

            <button
              className={`${styles.saveBtn} ${styles.saveBtnSoon}`}
              onClick={handleSave}
              title="Envio de notificações ainda não conectado — em breve"
            >
              Salvar configurações (em breve)
            </button>
          </div>
        </div>

        {/* Log de alertas */}
        <div>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Alertas recentes</h2>
            {alertsLoading ? (
              <div className={styles.loading}>Carregando alertas...</div>
            ) : alerts.length === 0 ? (
              <div className={styles.empty}>Nenhum alerta registrado.</div>
            ) : (
              <div className={styles.alertLog}>
                {alerts.map(a => {
                  const s = typeStyle[a.tipo] || typeStyle.info
                  return (
                    <div key={a.id} className={styles.alertItem} style={{ background: s.bg }}>
                      <div className={styles.alertIcon}>{s.icon}</div>
                      <div className={styles.alertBody}>
                        <p className={styles.alertMsg} style={{ color: s.color }}>{a.mensagem}</p>
                        <span className={styles.alertTime}>{formatAlertTime(a.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Status das metas */}
          <div className={styles.card} style={{ marginTop: 14 }}>
            <h2 className={styles.cardTitle}>Status das metas hoje</h2>
            {!today ? (
              <div className={styles.loading}>Carregando métricas de hoje...</div>
            ) : statuses.length === 0 ? (
              <div className={styles.empty}>Ative alguma meta ao lado pra acompanhar aqui.</div>
            ) : (
              <div className={styles.statusList}>
                {statuses.map(s => (
                  <StatusRow key={s.key} label={s.label} meta={s.meta} atual={s.atual} ok={s.ok} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusRow({ label, meta, atual, ok }) {
  return (
    <div className={styles.statusRow}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusMeta}>meta: {meta}</span>
      <span className={`${styles.statusAtual} ${ok ? styles.statusOk : styles.statusFail}`}>
        {ok ? '✓' : '⚠'} {atual}
      </span>
    </div>
  )
}

// Cruza uma goal (do Supabase) com o summary de hoje pra calcular
// meta formatada, valor atual real, e se está ok.
// Convenção:
//   - roas/ctr/mensagens/agendamentos/vendas → maior é melhor
//   - budget → menor é melhor (% de orçamento consumido)
function buildStatus(goal, data) {
  const base = { key: goal.key, label: goal.label, meta: '—', atual: '—', ok: true }
  if (!data) return { ...base, atual: '…' }

  switch (goal.key) {
    case 'roas': {
      const atual = Number(data.roas) || 0
      return { ...base, meta: `${goal.value}x`, atual: fmtRoas(atual), ok: atual >= goal.value }
    }
    case 'ctr': {
      // CTR Meta é a que Fabio investe mais — usada como referência
      const atual = Number(data.ctrMeta) || 0
      return { ...base, label: 'CTR (Meta)', meta: `${goal.value}%`, atual: fmtPct(atual), ok: atual >= goal.value }
    }
    case 'mensagens': {
      const atual = Number(data.mensagens) || 0
      return { ...base, meta: `${fmtNumber(goal.value)}/dia`, atual: fmtNumber(atual), ok: atual >= goal.value }
    }
    case 'agendamentos': {
      const atual = Number(data.agendamentos) || 0
      return { ...base, meta: `${fmtNumber(goal.value)}/sem`, atual: fmtNumber(atual), ok: atual >= goal.value }
    }
    case 'vendas': {
      const atual = Number(data.vendas) || 0
      return { ...base, meta: `${fmtNumber(goal.value)}/dia`, atual: fmtNumber(atual), ok: atual >= goal.value }
    }
    case 'budget': {
      // Consumo do orçamento planejado × investido no dia
      const planejado = Number(data.budget?.meta || 0) + Number(data.budget?.google || 0)
      if (planejado <= 0) return { ...base, meta: `<${goal.value}%`, atual: '—', ok: true }
      const pct = (Number(data.investimento) || 0) / planejado * 100
      return { ...base, meta: `<${goal.value}%`, atual: `${pct.toFixed(0)}%`, ok: pct <= goal.value }
    }
    default:
      return base
  }
}
