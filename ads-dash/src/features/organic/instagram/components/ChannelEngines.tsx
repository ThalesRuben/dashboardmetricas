import styles from './ChannelEngines.module.css'

// "Motores" de distribuição — visão estratégica de onde a marca publica.
// Conceito vindo da metodologia de distribuição: cada canal é um motor com função própria.
const ENGINES = [
  {
    key: 'instagram',
    nome: 'Instagram',
    cor: '#E1306C',
    papel: 'Motor principal',
    funcao: 'Prova social, alcance e geração de mensagens (CTWA)',
    status: 'ativo',
    icon: 'M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5a5 5 0 100 10 5 5 0 000-10zm5.5-.5a1 1 0 100 2 1 1 0 000-2z',
  },
  {
    key: 'tiktok',
    nome: 'TikTok',
    cor: '#000000',
    papel: 'Motor secundário',
    funcao: 'Captação de alcance barato — talking head e tendências',
    status: 'ativo',
    icon: 'M16 8.5a5 5 0 005 5v-3a2 2 0 01-2-2h-3zM9 12a4 4 0 104 4V8h3V5h-6v11a1 1 0 11-1-1v-3z',
  },
  {
    key: 'whatsapp',
    nome: 'WhatsApp',
    cor: '#25D366',
    papel: 'Motor de conversão',
    funcao: 'Onde o lead vira agendamento e venda',
    status: 'ativo',
    icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  },
  {
    key: 'youtube',
    nome: 'YouTube',
    cor: '#FF0000',
    papel: 'Motor de autoridade',
    funcao: 'Conteúdo longo — tutoriais e portfólio do salão',
    status: 'ativo',
    icon: 'M22 12s0-3.5-.5-5a3 3 0 00-2-2C17.5 4.5 12 4.5 12 4.5s-5.5 0-7.5.5a3 3 0 00-2 2C2 8.5 2 12 2 12s0 3.5.5 5a3 3 0 002 2c2 .5 7.5.5 7.5.5s5.5 0 7.5-.5a3 3 0 002-2c.5-1.5.5-5 .5-5zM10 15.5v-7l6 3.5-6 3.5z',
  },
]

const STATUS = {
  'ativo':        { label: 'Ativo',        cls: 'statusOk' },
  'a-configurar': { label: 'A configurar', cls: 'statusWarn' },
  'planejado':    { label: 'Planejado',    cls: 'statusSoft' },
}

export default function ChannelEngines() {
  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h3 className={styles.title}>⚙️ Motores de distribuição</h3>
        <p className={styles.sub}>Cada canal tem uma função na estratégia — não trate todos igual</p>
      </div>

      <div className={styles.grid}>
        {ENGINES.map(e => {
          const st = STATUS[e.status]
          return (
            <div key={e.key} className={styles.engine} style={{ '--cor': e.cor } as React.CSSProperties}>
              <div className={styles.engineHead}>
                <div className={styles.engineIcon} style={{ background: e.cor }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff">
                    <path d={e.icon} />
                  </svg>
                </div>
                <div className={styles.engineName}>{e.nome}</div>
                <span className={`${styles.status} ${styles[st.cls]}`}>{st.label}</span>
              </div>
              <div className={styles.papel}>{e.papel}</div>
              <div className={styles.funcao}>{e.funcao}</div>
            </div>
          )
        })}
      </div>

      <div className={styles.note}>
        ⓘ Instagram, TikTok e YouTube já têm telas dedicadas com métricas. Conecte as APIs de cada um
        para substituir os dados de demonstração pelos números reais.
      </div>
    </div>
  )
}
