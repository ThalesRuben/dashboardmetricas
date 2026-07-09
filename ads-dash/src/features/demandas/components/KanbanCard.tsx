import { useState, type DragEvent } from 'react';
import type { Demanda } from '../api/types';
import { PRIORIDADE_LABELS } from '../api/types';
import styles from './KanbanCard.module.css';

interface Props {
  demanda: Demanda;
  onClick: () => void;
}

export default function KanbanCard({ demanda, onClick }: Props) {
  const [dragging, setDragging] = useState(false);

  function handleDragStart(e: DragEvent<HTMLButtonElement>) {
    e.dataTransfer.setData('text/plain', demanda.id);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
  }

  function handleDragEnd() { setDragging(false); }

  return (
    <button
      type="button"
      className={`${styles.card} ${dragging ? styles.dragging : ''}`}
      data-prioridade={demanda.prioridade}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
    >
      <span className={styles.prio} title={`Prioridade: ${PRIORIDADE_LABELS[demanda.prioridade]}`} />
      <span className={styles.titulo}>{demanda.titulo}</span>
      {demanda.descricao && <span className={styles.desc}>{demanda.descricao}</span>}
    </button>
  );
}
