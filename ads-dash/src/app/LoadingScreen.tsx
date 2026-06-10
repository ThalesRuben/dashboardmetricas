import styles from './LoadingScreen.module.css'

export default function LoadingScreen({ label = 'Carregando...' }) {
  return (
    <div className={styles.screen}>
      <div className={styles.box}>
        <div className={styles.spinner} />
        <p className={styles.label}>{label}</p>
      </div>
    </div>
  )
}
