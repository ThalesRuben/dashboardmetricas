import { useState, type DragEvent } from 'react';
import type { Demanda, DemandaStatus, TeamMember } from '../api/types';
import KanbanCard from './KanbanCard';
import styles from './KanbanColumn.module.css';

interface Props {
  status: DemandaStatus;
  label: string;
  demandas: Demanda[];
  equipe: TeamMember[];
  reordenavel: boolean;         // se false, só drop no bulk (final)
  onAdicionar: () => void;
  onCardClick: (d: Demanda) => void;
  onDrop: (id: string, targetOrdem?: number) => void;
}

interface DropAlvo {
  cardId: string;
  position: 'before' | 'after';
}

// Calcula ordem "sanduíche" entre vizinhos. `cards` já ordenados asc por ordem,
// SEM o card arrastado.
function ordemEntre(cards: Demanda[], targetCardId: string, position: 'before' | 'after'): number {
  const idx = cards.findIndex(c => c.id === targetCardId);
  if (idx === -1) return cards.length ? cards[cards.length - 1].ordem + 10_000 : Date.now();

  const antesIdx = position === 'before' ? idx - 1 : idx;
  const depoisIdx = position === 'before' ? idx     : idx + 1;
  const antes  = antesIdx  >= 0            ? cards[antesIdx]  : null;
  const depois = depoisIdx <  cards.length ? cards[depoisIdx] : null;

  if (!antes  && depois) return depois.ordem - 10_000;
  if ( antes && !depois) return antes.ordem  + 10_000;
  if ( antes &&  depois) {
    const gap = depois.ordem - antes.ordem;
    if (gap < 2) return depois.ordem + 10_000;  // "rebalanceamento" preguiçoso
    return antes.ordem + Math.floor(gap / 2);
  }
  return Date.now();
}

export default function KanbanColumn({ status, label, demandas, equipe, reordenavel, onAdicionar, onCardClick, onDrop }: Props) {
  const [hover, setHover] = useState(false);
  const [alvo, setAlvo] = useState<DropAlvo | null>(null);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!hover) setHover(true);
  }

  function handleDragLeave() { setHover(false); setAlvo(null); }

  function handleDropColumn(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setHover(false);
    setAlvo(null);
    if (!id) return;
    if (alvo && reordenavel) {
      const semArrastado = demandas.filter(d => d.id !== id);
      const novaOrdem = ordemEntre(semArrastado, alvo.cardId, alvo.position);
      onDrop(id, novaOrdem);
    } else {
      onDrop(id);  // sem alvo específico → fim da coluna
    }
  }

  return (
    <section
      className={`${styles.column} ${hover ? styles.columnHover : ''}`}
      data-status={status}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropColumn}
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
          <KanbanCard
            key={d.id}
            demanda={d}
            equipe={equipe}
            onClick={() => onCardClick(d)}
            onDragOverCard={reordenavel ? (id, pos) => setAlvo({ cardId: id, position: pos }) : undefined}
            onDragLeaveCard={undefined}   // dragLeave por card faz o alvo piscar; limpa só no leave da coluna
            dropIndicator={alvo?.cardId === d.id ? alvo.position : null}
          />
        ))}
      </div>
    </section>
  );
}
