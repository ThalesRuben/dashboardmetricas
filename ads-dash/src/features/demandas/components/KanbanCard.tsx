import { useState, type DragEvent } from 'react';
import type { Demanda, TeamMember } from '../api/types';
import { PRIORIDADE_LABELS } from '../api/types';
import { colorForMember, initialsForMember } from './memberColors';
import styles from './KanbanCard.module.css';

interface Props {
  demanda: Demanda;
  equipe: TeamMember[];
  onClick: () => void;
  onDragOverCard?: (id: string, position: 'before' | 'after') => void;
  onDragLeaveCard?: () => void;
  dropIndicator?: 'before' | 'after' | null;
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

// Retorna a diferença em dias entre hoje (local, 00:00) e a data ISO YYYY-MM-DD.
// Positivo = futuro, negativo = passado, 0 = hoje.
function diasAtePrazo(prazoIso: string): number {
  const [y, m, d] = prazoIso.split('-').map(Number);
  const prazo = new Date(y, (m ?? 1) - 1, d ?? 1);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((prazo.getTime() - hoje.getTime()) / DIA_MS);
}

type PrazoTom = 'atrasado' | 'hoje' | 'proximo' | 'futuro';

interface BadgePrazo {
  tom: PrazoTom;
  texto: string;
}

function badgePrazo(demanda: Demanda): BadgePrazo | null {
  if (!demanda.prazo) return null;
  if (demanda.status === 'feito') return null;  // não polui feitos
  const dias = diasAtePrazo(demanda.prazo);
  if (dias < 0) {
    const abs = Math.abs(dias);
    return { tom: 'atrasado', texto: abs === 1 ? 'atrasada 1d' : `atrasada ${abs}d` };
  }
  if (dias === 0) return { tom: 'hoje', texto: 'vence hoje' };
  if (dias <= 3) return { tom: 'proximo', texto: dias === 1 ? 'vence amanhã' : `em ${dias}d` };
  const [, m, d] = demanda.prazo.split('-');
  return { tom: 'futuro', texto: `${d}/${m}` };
}

// Fallback: se não há prazo mas o card está travado no backlog com prioridade,
// mostra "parada" (lógica de antes).
function paradaSemPrazo(demanda: Demanda): boolean {
  if (demanda.prazo) return false;
  if (demanda.status !== 'backlog') return false;
  if (demanda.prioridade === 'baixa') return false;
  const dias = (Date.now() - new Date(demanda.criado_em).getTime()) / DIA_MS;
  return demanda.prioridade === 'alta' ? dias >= 3 : dias >= 7;
}

export default function KanbanCard({
  demanda,
  equipe,
  onClick,
  onDragOverCard,
  onDragLeaveCard,
  dropIndicator = null,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const responsavel = demanda.responsavel_id
    ? equipe.find(m => m.id === demanda.responsavel_id)
    : null;
  const badge = badgePrazo(demanda);
  const parada = paradaSemPrazo(demanda);

  function handleDragStart(e: DragEvent<HTMLButtonElement>) {
    e.dataTransfer.setData('text/plain', demanda.id);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
  }

  function handleDragEnd() { setDragging(false); }

  function positionFrom(e: DragEvent<HTMLButtonElement>): 'before' | 'after' {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }

  function handleDragOver(e: DragEvent<HTMLButtonElement>) {
    if (!onDragOverCard) return;
    e.preventDefault();  // permite drop no card; NÃO chama stopPropagation:
                         // a coluna precisa ver o drop pra ler o dataTransfer.
    e.dataTransfer.dropEffect = 'move';
    onDragOverCard(demanda.id, positionFrom(e));
  }

  return (
    <button
      type="button"
      className={`${styles.card} ${dragging ? styles.dragging : ''} ${dropIndicator === 'before' ? styles.dropBefore : ''} ${dropIndicator === 'after' ? styles.dropAfter : ''}`}
      data-prioridade={demanda.prioridade}
      data-status={demanda.status}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeaveCard}
      onClick={onClick}
    >
      <div className={styles.topo}>
        <span className={styles.flag} title={`Prioridade: ${PRIORIDADE_LABELS[demanda.prioridade]}`} aria-label={`Prioridade ${PRIORIDADE_LABELS[demanda.prioridade]}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4 3a1 1 0 011-1h13a1 1 0 01.8 1.6L15.25 8l3.55 4.4A1 1 0 0118 14H6v7a1 1 0 11-2 0V3z" />
          </svg>
        </span>
        <span className={styles.idade}>{idade(demanda.criado_em)}</span>
        {badge && (
          <span className={`${styles.badge} ${styles[`badge_${badge.tom}`]}`} title={`Prazo: ${demanda.prazo}`}>
            {badge.texto}
          </span>
        )}
        {!badge && parada && (
          <span className={`${styles.badge} ${styles.badge_atrasado}`} title="Parada há muito tempo com prioridade">
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
