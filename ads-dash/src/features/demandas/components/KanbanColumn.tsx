import { useState, type DragEvent } from 'react';
import type { Demanda, DemandaStatus, TeamMember } from '../api/types';
import KanbanCard from './KanbanCard';
import styles from './KanbanColumn.module.css';

interface Props {
  status: DemandaStatus;
  label: string;
  demandas: Demanda[];
  equipe: TeamMember[];
  onAdicionar: () => void;
  onCardClick: (d: Demanda) => void;
  onDrop: (id: string) => void;
}

export default function KanbanColumn({ status, label, demandas, equipe, onAdicionar, onCardClick, onDrop }: Props) {
  const [hover, setHover] = useState(false);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!hover) setHover(true);
  }

  function handleDragLeave() { setHover(false); }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setHover(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) onDrop(id);
  }

  return (
    <section
      className={`${styles.column} ${hover ? styles.columnHover : ''}`}
      data-status={status}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.dot} />
          <span className={styles.label}>{label}</span>
          <span className={styles.count}>{demandas.length}</span>
        </div>
        <button type="button" className={styles.addBtn} onClick={onAdicionar} aria-label={`Nova demanda em ${label}`}>
          +
        </button>
      </header>

      <div className={styles.cards}>
        {demandas.length === 0 && (
          <p className={styles.empty}>Nenhuma demanda aqui.</p>
        )}
        {demandas.map(d => (
          <KanbanCard key={d.id} demanda={d} equipe={equipe} onClick={() => onCardClick(d)} />
        ))}
      </div>
    </section>
  );
}
