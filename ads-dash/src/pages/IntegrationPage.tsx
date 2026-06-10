import { useState, useEffect } from 'react'
import { saveDailyMetrics } from '@/features/ads/hooks/useMetrics'
import { useMetricsContext } from '@/app/providers/MetricsContext'
import { useToast } from '@/app/providers/ToastContext'
import PageHeader from '@/components/ui/PageHeader'
import styles from './IntegrationPage.module.css'

const STORAGE_KEY = 'ads-dash:connections'

const CONNECTORS = [
  { key: 'instagram', nome: 'Instagram', cor: '#d4537e', conta: '@theblondeconcept',     desc: 'Seguidores, alcance, posts e Reels',
    icon: 'M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm5.5-.5a1 1 0 100 2 1 1 0 000-2z' },
  { key: 'tiktok', nome: 'TikTok', cor: '#cfcfcf', conta: '@theblondeconcept',           desc: 'Visualizações, seguidores e vídeos',
    icon: 'M16 8.5a5 5 0 005 5v-3a2 2 0 01-2-2h-3zM9 12a4 4 0 104 4V8h3V5h-6v11a1 1 0 11-1-1v-3z' },
  { key: 'youtube', nome: 'YouTube', cor: '#FF4444', conta: 'The Blonde Concept',        desc: 'Inscritos, visualizações e retenção',
    icon: 'M22 12s0-3.5-.5-5a3 3 0 00-2-2C17.5 4.5 12 4.5 12 4.5s-5.5 0-7.5.5a3 3 0 00-2 2C2 8.5 2 12 2 12s0 3.5.5 5a3 3 0 002 2c2 .5 7.5.5 7.5.5s5.5 0 7.5-.5a3 3 0 002-2c.5-1.5.5-5 .5-5zM10 15.5v-7l6 3.5-6 3.5z' },
  { key: 'whatsapp', nome: 'WhatsApp', cor: '#5dcaa5', conta: '+55 31 9 9999-0000',      desc: 'Conversas, leads e atendimento (CTWA)',
    icon: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z' },
  { key: 'meta', nome: 'Meta Ads', cor: '#85b7eb', conta: 'Conta de anúncios',           desc: 'Campanhas do Facebook e Instagram',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { key: 'google', nome: 'Google Ads', cor: '#5dcaa5', conta: 'Conta de anúncios',       desc: 'Campanhas de busca e display',
    icon: 'M21 12a9 9 0 11-6.2-8.5 M21 5v4h-4' },
]

function loadConnections() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {} } catch { return {} }
}

export default function IntegrationPage() {
  const toast = useToast()
  const [conns, setConns] = useState(loadConnections)
  const [connecting, setConnecting] = useState(null)
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conns)) } catch { /* ignore */ }
  }, [conns])

  function connect(c) {
    setConnecting(c.key)
    // simula o login/OAuth da conta (abriria o popup do provedor numa integração real)
    setTimeout(() => {
      setConns(prev => ({ ...prev, [c.key]: { conta: c.conta, em: Date.now() } }))
      setConnecting(null)
      toast.success(`${c.nome} conectado como ${c.conta}.`, { title: 'Conta conectada' })
    }, 1100)
  }

  function disconnect(c) {
    setConns(prev => { const n = { ...prev }; delete n[c.key]; return n })
    toast.info(`${c.nome} desconectado.`)
  }

  const conectados = Object.keys(conns).length

  return (
    <div className={styles.page}>
      <PageHeader
        section="integrations"
        title="Conecte suas contas"
        subtitle={conectados ? `${conectados} de ${CONNECTORS.length} contas conectadas` : 'Entre com cada conta para sincronizar os dados automaticamente'}
      />

      <div className={styles.grid}>
        {CONNECTORS.map(c => {
          const conn = conns[c.key]
          const loading = connecting === c.key
          return (
            <div key={c.key} className={`${styles.conn} ${conn ? styles.connOn : ''}`}>
              <div className={styles.connHead}>
                <div className={styles.connIcon} style={{ background: c.cor }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a0d12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={c.icon} />
                  </svg>
                </div>
                <div className={styles.connId}>
                  <span className={styles.connNome}>{c.nome}</span>
                  <span className={styles.connDesc}>{c.desc}</span>
                </div>
              </div>

              {conn ? (
                <div className={styles.connStatus}>
                  <span className={styles.connDot} />
                  Conectado como <strong>{conn.conta}</strong>
                </div>
              ) : (
                <div className={styles.connStatusOff}>Não conectado</div>
              )}

              {conn ? (
                <button className={styles.disconnectBtn} onClick={() => disconnect(c)}>Desconectar</button>
              ) : (
                <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => connect(c)} disabled={loading}>
                  {loading ? 'Conectando…' : `Entrar com ${c.nome}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className={styles.privacy}>
        🔒 O login abre a tela oficial de cada plataforma. Não guardamos sua senha — só o acesso autorizado para ler as métricas.
      </p>

      <button className={styles.manualToggle} onClick={() => setShowManual(s => !s)}>
        {showManual ? '− Ocultar entrada manual' : '+ Prefere inserir os números manualmente?'}
      </button>

      {showManual && <ManualEntry toast={toast} />}
    </div>
  )
}

function ManualEntry({ toast }) {
  const { loadAds } = useMetricsContext()
  const [manualData, setManualData] = useState({
    metaInvest: '', metaRevenue: '', metaImp: '', metaClk: '', metaMsgs: '', metaAgend: '',
    googleInvest: '', googleRevenue: '', googleImp: '', googleClk: '', googleConv: '', googleVendas: '',
  })
  const [saving, setSaving] = useState(false)
  const setField = (k, v) => setManualData(d => ({ ...d, [k]: v }))

  const n = k => parseFloat(manualData[k]) || 0
  const totalInvest  = n('metaInvest') + n('googleInvest')
  const totalRevenue = n('metaRevenue') + n('googleRevenue')
  const totalMsgs    = n('metaMsgs')
  const totalAgend   = n('metaAgend')
  const totalVendas  = n('googleVendas')
  const totalImp     = n('metaImp') + n('googleImp')
  const totalClk     = n('metaClk') + n('googleClk')
  const roas = totalInvest > 0 ? (totalRevenue / totalInvest).toFixed(2) : '—'
  const roi  = totalInvest > 0 ? Math.round(((totalRevenue - totalInvest) / totalInvest) * 100) + '%' : '—'
  const ctrMeta   = n('metaImp')   > 0 ? (n('metaClk')   / n('metaImp')   * 100).toFixed(2) + '%' : '—'
  const ctrGoogle = n('googleImp') > 0 ? (n('googleClk') / n('googleImp') * 100).toFixed(2) + '%' : '—'

  async function handleSaveManual() {
    if (totalInvest <= 0) { toast.error('Informe ao menos o investimento para salvar.'); return }
    setSaving(true)
    const payload = {
      roas: parseFloat(roas) || 0, roi: parseInt(roi) || 0,
      ctrMeta: parseFloat(ctrMeta) || 0, ctrGoogle: parseFloat(ctrGoogle) || 0,
      mensagens: totalMsgs, agendamentos: totalAgend, vendas: totalVendas,
      investimento: totalInvest, receita: totalRevenue,
      funil: { impressoes: totalImp, cliques: totalClk, mensagens: totalMsgs, agendamentos: totalAgend, vendas: totalVendas },
      campanhas: [],
      chartRoas: { labels: ['Meta Ads', 'Google Ads'], hoje: [parseFloat(ctrMeta) || 0, parseFloat(ctrGoogle) || 0], ontem: [0, 0] },
      chartConv: { labels: ['—'], mensagens: [totalMsgs], agendamentos: [totalAgend], vendas: [totalVendas] },
      chartCtr:  { labels: ['—'], meta: [parseFloat(ctrMeta) || 0], google: [parseFloat(ctrGoogle) || 0] },
      budget:    { meta: n('metaInvest'), google: n('googleInvest') },
    }
    const { error } = await saveDailyMetrics('hoje', payload, 'manual')
    setSaving(false)
    if (error) toast.error('Erro ao salvar: ' + (error.message || 'verifique a conexão.'))
    else { toast.success('Dados salvos! O dashboard foi atualizado.'); loadAds('hoje') }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Entrada manual — dados de hoje</h2>
      <div className={styles.infoBox}>Cole os números do Meta Ads Manager e do Google Ads. ROAS, ROI e CTR são calculados automaticamente.</div>

      <div className={styles.sectionLabel}>Meta Ads</div>
      <div className={styles.manualGrid}>
        <ManualField label="Investimento (R$)"   value={manualData.metaInvest}   onChange={v => setField('metaInvest', v)} />
        <ManualField label="Receita gerada (R$)" value={manualData.metaRevenue}  onChange={v => setField('metaRevenue', v)} />
        <ManualField label="Impressões"           value={manualData.metaImp}      onChange={v => setField('metaImp', v)} />
        <ManualField label="Cliques"              value={manualData.metaClk}      onChange={v => setField('metaClk', v)} />
        <ManualField label="Mensagens (CTWA)"     value={manualData.metaMsgs}     onChange={v => setField('metaMsgs', v)} />
        <ManualField label="Agendamentos"         value={manualData.metaAgend}    onChange={v => setField('metaAgend', v)} />
      </div>

      <div className={styles.divider} />
      <div className={styles.sectionLabel}>Google Ads</div>
      <div className={styles.manualGrid}>
        <ManualField label="Investimento (R$)"   value={manualData.googleInvest}   onChange={v => setField('googleInvest', v)} />
        <ManualField label="Receita gerada (R$)" value={manualData.googleRevenue}  onChange={v => setField('googleRevenue', v)} />
        <ManualField label="Impressões"           value={manualData.googleImp}      onChange={v => setField('googleImp', v)} />
        <ManualField label="Cliques"              value={manualData.googleClk}      onChange={v => setField('googleClk', v)} />
        <ManualField label="Conversões"           value={manualData.googleConv}     onChange={v => setField('googleConv', v)} />
        <ManualField label="Vendas aprovadas"     value={manualData.googleVendas}   onChange={v => setField('googleVendas', v)} />
      </div>

      <div className={styles.divider} />
      <div className={styles.sectionLabel}>Resultados calculados</div>
      <div className={styles.resultsGrid}>
        <Result label="ROAS total"    value={roas !== '—' ? roas + 'x' : '—'} highlight={roas !== '—'} />
        <Result label="ROI total"     value={roi} highlight={roi !== '—'} />
        <Result label="CTR Meta"      value={ctrMeta} />
        <Result label="CTR Google"    value={ctrGoogle} />
        <Result label="Invest. total" value={totalInvest > 0 ? 'R$' + totalInvest.toLocaleString('pt-BR') : '—'} />
        <Result label="Receita total" value={totalRevenue > 0 ? 'R$' + totalRevenue.toLocaleString('pt-BR') : '—'} />
      </div>

      <button onClick={handleSaveManual} disabled={saving || totalInvest <= 0} className={styles.saveBtn}>
        {saving ? 'Salvando...' : 'Salvar no dashboard'}
      </button>
    </div>
  )
}

function ManualField({ label, value, onChange }) {
  return (
    <div className={styles.manualField}>
      <label className={styles.manualLabel}>{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder="0" className={styles.manualInput} />
    </div>
  )
}

function Result({ label, value, highlight = false }) {
  return (
    <div className={styles.resultBox}>
      <div className={highlight ? styles.resultValHi : styles.resultVal}>{value}</div>
      <div className={styles.resultLbl}>{label}</div>
    </div>
  )
}
