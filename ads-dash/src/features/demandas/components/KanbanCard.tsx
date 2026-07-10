import { useState, type DragEvent } from 'react';
import type { Demanda, TeamMember } from '../api/types';
import { PRIORIDADE_LABELS } from '../api/types';
import { colorForMember, initialsForMember } from './memberColors';
import styles from './KanbanCard.module.css';

interface Props {
  demanda: Demanda;
  equipe: TeamMember[];
  onClick: () => void;
}

const DIA_MS = 86_400_000;

function idade(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `há ${Math.max(1, mins)}min`;
  const horas = Math.round(mins / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(diff / DIA_MS);
  if (dias < 30) return `há ${dias}d`;
  return `há ${Math.round(dias / 30)}m`;
}

function ehParada(demanda: Demanda): boolean {
  if (demanda.status !== 'backlog') return false;
  if (demanda.prioridade === 'baixa') return false;
  const dias = (Date.now() - new Date(demanda.criado_em).getTime()) / DIA_MS;
  return demanda.prioridade === 'alta' ? dias >= 3 : dias >= 7;
}

export default function KanbanCard({ demanda, equipe, onClick }: Props) {
  const [dragging, setDragging] = useState(false);
  const responsavel = demanda.responsavel_id
    ? equipe.find(m => m.id === demanda.responsavel_id)
    : null;
  const parada = ehParada(demanda);

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
      data-status={demanda.status}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
    >
      <div className={styles.topo}>
        <span className={styles.flag} title={`Prioridade: ${PRIORIDADE_LABELS[demanda.prioridade]}`} aria-label={`Prioridade ${PRIORIDADE_LABELS[demanda.prioridade]}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4 3a1 1 0 011-1h13a1 1 0 01.8 1.6L15.25 8l3.55 4.4A1 1 0 0118 14H6v7a1 1 0 11-2 0V3z" />
          </svg>
        </span>
        <span className={styles.idade}>{idade(demanda.criado_em)}</span>
        {parada && (
          <span className={styles.parada} title="Parada há muito tempo com prioridade">
            parada
          </span>
        )}
      </div>

      <span className={styles.titulo}>{demanda.titulo}</span>
      {demanda.descricao && <span className={styles.desc}>{demanda.descricao}</span>}

      <div className={styles.rodape}>
        {responsavel ? (
          <span className={styles.responsavel} title={`Responsável: ${responsavel.full_name}`}>
            <span className={styles.avatar} style={{ background: colorForMember(responsavel.id) }}>
              {initialsForMember(responsavel.full_name)}
            </span>
            <span className={styles.respNome}>{responsavel.full_name}</span>
          </span>
        ) : (
          <span className={styles.semDono}>sem responsável</span>
        )}
      </div>
    </button>
  );
}
