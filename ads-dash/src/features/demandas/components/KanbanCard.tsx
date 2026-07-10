import { useState, type DragEvent } from 'react';
import type { Demanda, TeamMember } from '../api/types';
import { PRIORIDADE_LABELS } from '../api/types';
import styles from './KanbanCard.module.css';

interface Props {
  demanda: Demanda;
  equipe: TeamMember[];
  onClick: () => void;
}

function iniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function KanbanCard({ demanda, equipe, onClick }: Props) {
  const [dragging, setDragging] = useState(false);
  const responsavel = demanda.responsavel_id
    ? equipe.find(m => m.id === demanda.responsavel_id)
    : null;

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
      {responsavel && (
        <span className={styles.responsavel} title={`Responsável: ${responsavel.full_name}`}>
          <span className={styles.avatar}>{iniciais(responsavel.full_name)}</span>
          <span className={styles.respNome}>{responsavel.full_name}</span>
        </span>
      )}
    </button>
  );
}
