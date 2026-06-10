import { Link } from 'react-router-dom'
import styles from './BibleBadge.module.css'

/**
 * Selo "regido pela Bíblia" — amarra o painel de volta à fonte da verdade.
 *   <BibleBadge to="/bible#diretriz">Filtre tudo pelo padrão TBC</BibleBadge>
 * `to` default = /bible. Use #<id da seção> pra abrir direto na aba.
 */
export default function BibleBadge({ to = '/bible', children }) {
  return (
    <Link to={to} className={styles.badge}>
      <span className={styles.mark}>★</span>
      <span className={styles.text}>{children}</span>
      <span className={styles.arrow}>→</span>
    </Link>
  )
}
