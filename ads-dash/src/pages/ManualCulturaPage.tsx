import PageHeader from '@/components/ui/PageHeader'
import styles from './ManualCulturaPage.module.css'

const URL_MANUAL = 'https://theblondeconcept.com.br/manualdecultura/'

export default function ManualCulturaPage() {
  return (
    <div className={styles.page}>
      <PageHeader
        section="cultura"
        title="Manual de Cultura"
        subtitle="Conteúdo oficial — theblondeconcept.com.br/manualdecultura"
        actions={
          <a href={URL_MANUAL} target="_blank" rel="noopener noreferrer" className="btn">
            ↗ Abrir em nova aba
          </a>
        }
      />
      <div className={styles.frameWrap}>
        <iframe
          src={URL_MANUAL}
          title="Manual de Cultura — The Blonde Concept"
          className={styles.frame}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  )
}
