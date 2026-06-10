import styles from './CampaignTable.module.css'

const PLAT_CLASS = { Meta: styles.tagMeta, Google: styles.tagGoogle }
const TYPE_CLASS  = { 'CTWA': styles.tagCtwa, 'API Conv.': styles.tagApi }

export default function CampaignTable({ campanhas }) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Plataforma</th>
            <th>Tipo</th>
            <th>Investido</th>
            <th>CTR</th>
            <th>Mensagens</th>
            <th>Agend.</th>
            <th>Vendas</th>
            <th>ROAS</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {campanhas.map(c => (
            <tr key={c.id}>
              <td className={styles.campaignName}>{c.nome}</td>
              <td><span className={`${styles.tag} ${PLAT_CLASS[c.plataforma]}`}>{c.plataforma}</span></td>
              <td><span className={`${styles.tag} ${TYPE_CLASS[c.tipo]}`}>{c.tipo}</span></td>
              <td>R${c.investido.toLocaleString('pt-BR')}</td>
              <td>{c.ctr}%</td>
              <td>{c.mensagens || '—'}</td>
              <td>{c.agendamentos || '—'}</td>
              <td>{c.vendas || '—'}</td>
              <td className={c.roas >= 3.5 ? styles.roasGood : styles.roasBad}>{c.roas}x</td>
              <td>
                <span className={c.status === 'ativo' ? styles.statusOk : styles.statusWarn}>
                  {c.status === 'ativo' ? '● Ativo' : '⚠ Revisar'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
