import { useState } from 'react'
import { useMetrics } from '@/features/ads/hooks/useMetrics'
import DateRangePicker, { fromPreset, formatDate } from '@/shared/ui/DateRangePicker'
import SchedulesTab from './reports/SchedulesTab'
import PageHeader from '@/components/ui/PageHeader'
import { fmtNumber, fmtBRL, fmtCompact, fmtRoas, fmtPct } from '@/shared/lib/format'
import styles from './ReportsPage.module.css'

const METRICS_OPTIONS = [
  { key: 'roas',          label: 'ROAS' },
  { key: 'roi',           label: 'ROI' },
  { key: 'ctr',           label: 'CTR (Meta e Google)' },
  { key: 'mensagens',     label: 'Mensagens (CTWA)' },
  { key: 'agendamentos',  label: 'Agendamentos' },
  { key: 'vendas',        label: 'Vendas aprovadas' },
  { key: 'investimento',  label: 'Investimento total' },
  { key: 'receita',       label: 'Receita gerada' },
  { key: 'campanhas',     label: 'Tabela de campanhas' },
  { key: 'funil',         label: 'Funil de conversão' },
]

export default function ReportsPage() {
  const [tab, setTab]         = useState('exportar')
  const [period, setPeriod]   = useState('hoje')
  const [customRange, setCustomRange] = useState(() => fromPreset('7'))
  const [format, setFormat]   = useState('pdf')
  const [metrics, setMetrics] = useState(['roas','roi','ctr','mensagens','vendas','campanhas'])
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [salonName, setSalonName] = useState('Salão')

  const periodForFetch = period === 'custom' ? 'hoje' : period
  const { data } = useMetrics(periodForFetch as 'hoje' | 'semana' | 'mes')

  function toggleMetric(k) {
    setMetrics(m => m.includes(k) ? m.filter(x => x !== k) : [...m, k])
  }

  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function buildCsv(d) {
    const lines = []
    lines.push(['Cliente', salonName].join(';'))
    lines.push(['Período', periodLabels[period]].join(';'))
    lines.push(['Gerado em', new Date().toLocaleString('pt-BR')].join(';'))
    lines.push('')

    if (metrics.includes('roas'))         lines.push(['ROAS',         d.roas + 'x'].join(';'))
    if (metrics.includes('roi'))          lines.push(['ROI',          d.roi + '%'].join(';'))
    if (metrics.includes('ctr'))          lines.push(['CTR Meta',     d.ctrMeta + '%'].join(';'))
    if (metrics.includes('ctr'))          lines.push(['CTR Google',   d.ctrGoogle + '%'].join(';'))
    if (metrics.includes('mensagens'))    lines.push(['Mensagens',    d.mensagens].join(';'))
    if (metrics.includes('agendamentos')) lines.push(['Agendamentos', d.agendamentos].join(';'))
    if (metrics.includes('vendas'))       lines.push(['Vendas',       d.vendas].join(';'))
    if (metrics.includes('investimento')) lines.push(['Investimento','R$ ' + d.investimento.toLocaleString('pt-BR')].join(';'))
    if (metrics.includes('receita'))      lines.push(['Receita',     'R$ ' + d.receita.toLocaleString('pt-BR')].join(';'))

    if (metrics.includes('funil')) {
      lines.push('')
      lines.push('FUNIL DE CONVERSÃO')
      lines.push(['Etapa','Total'].join(';'))
      Object.entries(d.funil).forEach(([k,v]) => lines.push([k, v].join(';')))
    }

    if (metrics.includes('campanhas') && d.campanhas?.length) {
      lines.push('')
      lines.push('CAMPANHAS')
      lines.push(['Nome','Plataforma','Tipo','Investido','CTR','Mensagens','Agendamentos','Vendas','ROAS','Status'].join(';'))
      d.campanhas.forEach(c => lines.push([
        c.nome, c.plataforma, c.tipo,
        'R$ ' + c.investido.toLocaleString('pt-BR'),
        c.ctr + '%',
        c.mensagens || 0, c.agendamentos || 0, c.vendas || 0,
        c.roas + 'x', c.status,
      ].join(';')))
    }

    return lines.join('\n')
  }

  function buildHtmlReport(d) {
    const today = new Date().toLocaleDateString('pt-BR')
    const k = (l, v) => `<div style="display:inline-block;background:#fff;border:1px solid #e8eaed;border-radius:8px;padding:14px 18px;margin:4px;min-width:140px;text-align:center"><div style="font-size:22px;font-weight:700;color:#185FA5">${v}</div><div style="font-size:11px;color:#999;margin-top:4px">${l}</div></div>`
    const row = (l, v) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;color:#555">${l}</td><td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;color:#1a1a1a;font-weight:600">${v}</td></tr>`
    const camps = (d.campanhas || []).map(c => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${c.nome}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${c.plataforma}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${c.tipo}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">R$ ${c.investido.toLocaleString('pt-BR')}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${c.ctr}%</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-weight:600;color:${c.roas >= 3.5 ? '#3B6D11' : '#A32D2D'}">${c.roas}x</td>
      </tr>`).join('')

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${salonName} — Relatório</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8f9fb;color:#1a1a1a;padding:32px;max-width:900px;margin:auto}h1{font-size:22px;margin-bottom:4px}.sub{color:#888;font-size:13px;margin-bottom:24px}.section{background:#fff;border:1px solid #eaeaea;border-radius:12px;padding:18px;margin-bottom:14px}.section h2{font-size:15px;margin-bottom:10px}table{width:100%;border-collapse:collapse;font-size:12px}th{text-align:left;padding:6px 10px;background:#fafafa;color:#999;font-weight:500;border-bottom:1px solid #eaeaea}@media print{body{background:#fff;padding:0}.noprint{display:none}}</style>
      </head><body>
      <h1>${salonName} — Relatório de Mídia</h1>
      <div class="sub">${periodLabels[period]} · Gerado em ${today}</div>

      <div class="section"><h2>Indicadores principais</h2>
        ${metrics.includes('roas')         ? k('ROAS',         d.roas + 'x') : ''}
        ${metrics.includes('roi')          ? k('ROI',          d.roi + '%') : ''}
        ${metrics.includes('ctr')          ? k('CTR Meta',     d.ctrMeta + '%') : ''}
        ${metrics.includes('ctr')          ? k('CTR Google',   d.ctrGoogle + '%') : ''}
        ${metrics.includes('mensagens')    ? k('Mensagens',    d.mensagens) : ''}
        ${metrics.includes('agendamentos') ? k('Agendamentos', d.agendamentos) : ''}
        ${metrics.includes('vendas')       ? k('Vendas',       d.vendas) : ''}
        ${metrics.includes('investimento') ? k('Investimento', 'R$ ' + d.investimento.toLocaleString('pt-BR')) : ''}
        ${metrics.includes('receita')      ? k('Receita',      'R$ ' + d.receita.toLocaleString('pt-BR')) : ''}
      </div>

      ${metrics.includes('funil') ? `<div class="section"><h2>Funil de conversão</h2>
        <table><tbody>
          ${row('Impressões', d.funil.impressoes.toLocaleString('pt-BR'))}
          ${row('Cliques',    d.funil.cliques.toLocaleString('pt-BR'))}
          ${row('Mensagens',  d.funil.mensagens.toLocaleString('pt-BR'))}
          ${row('Agendamentos', d.funil.agendamentos.toLocaleString('pt-BR'))}
          ${row('Vendas',     d.funil.vendas.toLocaleString('pt-BR'))}
        </tbody></table></div>` : ''}

      ${metrics.includes('campanhas') && d.campanhas?.length ? `<div class="section"><h2>Campanhas</h2>
        <table>
          <thead><tr><th>Nome</th><th>Plataforma</th><th>Tipo</th><th>Invest.</th><th>CTR</th><th>ROAS</th></tr></thead>
          <tbody>${camps}</tbody>
        </table></div>` : ''}

      <div class="noprint" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="background:#185FA5;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-size:13px;cursor:pointer">Imprimir / Salvar como PDF</button></div>
    </body></html>`
  }

  async function handleExport() {
    if (!data) return
    setLoading(true)
    setDone(false)
    await new Promise(r => setTimeout(r, 600))

    const safeName = salonName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'relatorio'
    const stamp = new Date().toISOString().slice(0, 10)

    if (format === 'pdf') {
      const html = buildHtmlReport(data)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      downloadFile(blob, `${safeName}-${stamp}.html`)
    } else {
      const csv = buildCsv(data)
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
      downloadFile(blob, `${safeName}-${stamp}.csv`)
    }

    setLoading(false)
    setDone(true)
    setTimeout(() => setDone(false), 4000)
  }

  const periodLabels = { hoje: 'Hoje', semana: 'Últimos 7 dias', mes: 'Últimos 30 dias', custom: 'Período personalizado' }

  return (
    <div className={styles.page}>
      <PageHeader
        section="reports"
        title="Relatórios"
        subtitle="Exporte métricas em PDF ou Excel — ou agende envio automático por e-mail"
      />

      <div className={styles.topTabs}>
        <button
          className={`${styles.topTab} ${tab === 'exportar' ? styles.topTabActive : ''}`}
          onClick={() => setTab('exportar')}
        >
          Exportar agora
        </button>
        <button
          className={`${styles.topTab} ${tab === 'agendar' ? styles.topTabActive : ''}`}
          onClick={() => setTab('agendar')}
        >
          Agendamentos automáticos
        </button>
      </div>

      {tab === 'agendar' && <SchedulesTab />}

      {tab === 'exportar' && (
      <div className={styles.grid}>
        {/* Configuração */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Configurar relatório</h2>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Nome do salão / cliente</label>
            <input
              className={styles.input}
              value={salonName}
              onChange={e => setSalonName(e.target.value)}
              placeholder="Ex: Salão Bella"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Período</label>
            <div className={styles.periodGrid}>
              {Object.entries(periodLabels).map(([k, v]) => (
                <button
                  key={k}
                  className={`${styles.periodBtn} ${period === k ? styles.periodActive : ''}`}
                  onClick={() => setPeriod(k)}
                >
                  {v}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className={styles.dateRow}>
                <DateRangePicker value={customRange} onChange={setCustomRange} />
                <span className={styles.dateSep}>
                  {customRange ? `${formatDate(customRange.from)} – ${formatDate(customRange.to)}` : ''}
                </span>
              </div>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Formato de exportação</label>
            <div className={styles.formatRow}>
              <button
                className={`${styles.formatBtn} ${format === 'pdf' ? styles.formatActive : ''}`}
                onClick={() => setFormat('pdf')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                PDF
              </button>
              <button
                className={`${styles.formatBtn} ${format === 'xlsx' ? styles.formatActive : ''}`}
                onClick={() => setFormat('xlsx')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                Excel (.xlsx)
              </button>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Métricas a incluir</label>
            <div className={styles.metricsList}>
              {METRICS_OPTIONS.map(m => (
                <label key={m.key} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={metrics.includes(m.key)}
                    onChange={() => toggleMetric(m.key)}
                    className={styles.checkbox}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            className={`${styles.exportBtn} ${loading ? styles.exportLoading : ''}`}
            onClick={handleExport}
            disabled={loading || metrics.length === 0 || !data}
          >
            {loading
              ? 'Gerando relatório...'
              : `Exportar ${format === 'pdf' ? 'PDF (HTML imprimível)' : 'Excel (CSV)'}`}
          </button>

          {done && (
            <div className={styles.successBox}>
              ✓ Arquivo gerado com sucesso! {format === 'pdf' ? 'Abra o HTML e use Imprimir → Salvar como PDF.' : 'Abra o CSV no Excel ou Google Sheets.'}
            </div>
          )}
        </div>

        {/* Preview */}
        <div className={styles.preview}>
          <h2 className={styles.cardTitle}>Preview do relatório</h2>
          <div className={styles.previewDoc}>
            <div className={styles.previewHeader}>
              <div className={styles.previewLogo} />
              <div>
                <div className={styles.previewTitle}>{salonName || 'Salão'} — Relatório de Mídia</div>
                <div className={styles.previewSub}>{periodLabels[period]} · {format.toUpperCase()}</div>
              </div>
            </div>

            <div className={styles.previewDivider} />

            {!data ? (
              <div className={styles.previewRow}>
                <span style={{ color: 'var(--text-subtle)' }}>Carregando dados do período…</span>
              </div>
            ) : (
              <>
                <div className={styles.previewKpis}>
                  {metrics.includes('roas')         && <PreviewKpi label="ROAS"    value={fmtRoas(data.roas)} />}
                  {metrics.includes('roi')          && <PreviewKpi label="ROI"     value={`${data.roi}%`} />}
                  {metrics.includes('investimento') && <PreviewKpi label="Invest." value={fmtBRL(data.investimento)} />}
                  {metrics.includes('receita')      && <PreviewKpi label="Receita" value={fmtBRL(data.receita)} />}
                </div>

                {metrics.includes('ctr') && (
                  <div className={styles.previewRow}>
                    <span>CTR Meta / Google</span><strong>{fmtPct(data.ctrMeta)} · {fmtPct(data.ctrGoogle)}</strong>
                  </div>
                )}
                {metrics.includes('mensagens') && (
                  <div className={styles.previewRow}>
                    <span>Mensagens CTWA</span><strong>{fmtNumber(data.mensagens)}</strong>
                  </div>
                )}
                {metrics.includes('agendamentos') && (
                  <div className={styles.previewRow}>
                    <span>Agendamentos</span><strong>{fmtNumber(data.agendamentos)}</strong>
                  </div>
                )}
                {metrics.includes('vendas') && (
                  <div className={styles.previewRow}>
                    <span>Vendas aprovadas</span><strong>{fmtNumber(data.vendas)}</strong>
                  </div>
                )}
                {metrics.includes('funil') && (
                  <FunilPreview funil={data.funil} />
                )}
                {metrics.includes('campanhas') && (
                  <div className={styles.previewTable}>
                    <div className={styles.previewTh}>Campanha · ROAS · Status</div>
                    {(data.campanhas || []).slice(0, 5).map(c => (
                      <div key={c.id ?? c.nome} className={styles.previewTr}>
                        {c.nome} · {fmtRoas(c.roas)} · {c.status}
                      </div>
                    ))}
                    {(!data.campanhas || data.campanhas.length === 0) && (
                      <div className={styles.previewTr} style={{ opacity: 0.55 }}>
                        Sem campanhas no período.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div className={styles.previewFooter}>
              Gerado pelo Backoffice The Blonde Concept · {new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

function PreviewKpi({ label, value }) {
  return (
    <div className={styles.previewKpi}>
      <div className={styles.previewKpiVal}>{value}</div>
      <div className={styles.previewKpiLbl}>{label}</div>
    </div>
  )
}

function FunilPreview({ funil }) {
  if (!funil) return null
  const top = Math.max(
    Number(funil.impressoes) || 0,
    Number(funil.cliques) || 0,
    1,
  )
  const rows = [
    { label: 'Impressões',   value: funil.impressoes,   opacity: 1 },
    { label: 'Cliques',      value: funil.cliques,      opacity: 0.8 },
    { label: 'Mensagens',    value: funil.mensagens,    opacity: 0.65 },
    { label: 'Agendamentos', value: funil.agendamentos, opacity: 0.5 },
    { label: 'Vendas',       value: funil.vendas,       opacity: 0.4 },
  ]
  return (
    <div className={styles.previewFunil}>
      {rows.map(r => {
        const pct = Math.max(6, Math.min(100, ((Number(r.value) || 0) / top) * 100))
        return (
          <div
            key={r.label}
            className={styles.previewFunilBar}
            style={{ width: `${pct}%`, opacity: r.opacity }}
          >
            {r.label} {fmtCompact(r.value)}
          </div>
        )
      })}
    </div>
  )
}
