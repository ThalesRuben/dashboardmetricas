import { useState } from 'react'
import styles from './MarketRadar.module.css'

// Radar de mercado — feed de atualizações do setor e dos concorrentes.
// Mock: numa integração real, alimentado por scraping/alertas + resumo da IA.
const MOCK_UPDATES = [
  { id: 1, data: '19/05', tipo: 'movimento',    segmento: 'Salão de beleza',
    titulo: 'Studio Glam lançou pacote "Noiva 2026"',
    descricao: 'Concorrente direto entrou com combo de noiva a partir de R$ 890 e está rodando anúncio no Meta há 6 dias.',
    fonte: 'Meta Ad Library' },
  { id: 2, data: '18/05', tipo: 'tendencia',    segmento: 'Conteúdo',
    titulo: 'Formato "POV cliente reagindo" em alta no TikTok',
    descricao: 'Vídeos de reação de clientes ao resultado estão com 2,4x mais alcance médio no nicho de beleza essa semana.',
    fonte: 'Tendências TikTok' },
  { id: 3, data: '17/05', tipo: 'oportunidade', segmento: 'SEO / orgânico',
    titulo: 'Busca por "progressiva sem formol" subiu 31%',
    descricao: 'Pico de interesse na região. Janela boa para conteúdo e anúncio focados nesse serviço.',
    fonte: 'Google Trends' },
  { id: 4, data: '15/05', tipo: 'alerta',       segmento: 'Salão de beleza',
    titulo: 'Espaço Vip recebeu 9 reclamações novas no Reclame Aqui',
    descricao: 'Reputação do concorrente caiu para 6,8. Oportunidade de reforçar prova social e garantia no seu posicionamento.',
    fonte: 'Reclame Aqui' },
  { id: 5, data: '13/05', tipo: 'movimento',    segmento: 'Influência',
    titulo: 'Bella Hair fechou parceria com microinfluenciadora',
    descricao: '@camirocha (8,6k) começou a divulgar o concorrente com cupom próprio.',
    fonte: 'Monitoramento Instagram' },
]

const TIPO = {
  movimento:    { label: 'Movimento',    tone: styles.tMov },
  tendencia:    { label: 'Tendência',    tone: styles.tTrend },
  oportunidade: { label: 'Oportunidade', tone: styles.tOp },
  alerta:       { label: 'Alerta',       tone: styles.tAlert },
}

const FILTERS = [
  { key: 'todos',        label: 'Todos' },
  { key: 'movimento',    label: 'Movimentos' },
  { key: 'tendencia',    label: 'Tendências' },
  { key: 'oportunidade', label: 'Oportunidades' },
  { key: 'alerta',       label: 'Alertas' },
]

export default function MarketRadar() {
  const [filtro, setFiltro] = useState('todos')
  const updates = filtro === 'todos' ? MOCK_UPDATES : MOCK_UPDATES.filter(u => u.tipo === filtro)

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Radar de mercado</h2>
          <p className={styles.sub}>Atualizações do setor, concorrentes e tendências — varredura diária 09h.</p>
        </div>
        <span className={styles.live}><span className={styles.dot} />MONITORANDO</span>
      </div>

      <div className={styles.filters}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`${styles.filter} ${filtro === f.key ? styles.filterActive : ''}`}
            onClick={() => setFiltro(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.feed}>
        {updates.map(u => {
          const t = TIPO[u.tipo]
          return (
            <div key={u.id} className={`${styles.item}`}>
              <div className={styles.itemSide}>
                <span className={styles.itemData}>{u.data}</span>
                <span className={`${styles.itemTipo} ${t.tone}`}>{t.label}</span>
              </div>
              <div className={styles.itemBody}>
                <h3 className={styles.itemTitle}>{u.titulo}</h3>
                <p className={styles.itemDesc}>{u.descricao}</p>
                <span className={styles.itemFonte}>{u.segmento} · fonte: {u.fonte}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
