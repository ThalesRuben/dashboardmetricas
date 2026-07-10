import { useDemandas } from '@/features/demandas';
import KanbanBoard from '@/features/demandas/components/KanbanBoard';
import PageHeader from '@/components/ui/PageHeader';
import styles from './DemandasPage.module.css';

export default function DemandasPage() {
  const { porStatus, equipe, loading, criar, atualizar, remover, moverPara } = useDemandas();

  return (
    <div className={styles.page}>
      <PageHeader
        section="demandas"
        title="Demandas"
        subtitle="Kanban interno pra organizar o que precisa ser feito. Arraste os cards entre as colunas."
      />

      {loading ? (
        <p className={styles.loading}>Carregando…</p>
      ) : (
        <KanbanBoard
          porStatus={porStatus}
          equipe={equipe}
          onCriar={criar}
          onAtualizar={atualizar}
          onRemover={remover}
          onMover={moverPara}
        />
      )}
    </div>
  );
}
