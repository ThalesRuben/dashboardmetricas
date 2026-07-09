import { useState } from 'react';
import type {
  Demanda,
  DemandaStatus,
  DemandaPrioridade,
} from '../api/types';
import { STATUS_LABELS } from '../api/types';
import KanbanColumn from './KanbanColumn';
import DemandaModal from './DemandaModal';
import styles from './KanbanBoard.module.css';

interface Props {
  porStatus: Record<DemandaStatus, Demanda[]>;
  onCriar: (input: { titulo: string; descricao?: string | null; status?: DemandaStatus; prioridade?: DemandaPrioridade }) => Promise<void>;
  onAtualizar: (input: { id: string; titulo?: string; descricao?: string | null; prioridade?: DemandaPrioridade }) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
  onMover: (id: string, status: DemandaStatus) => Promise<void>;
}

const COLUNAS: DemandaStatus[] = ['backlog', 'fazendo', 'feito'];

export default function KanbanBoard({ porStatus, onCriar, onAtualizar, onRemover, onMover }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Demanda | null>(null);
  const [statusPadrao, setStatusPadrao] = useState<DemandaStatus>('backlog');

  function abrirNova(status: DemandaStatus) {
    setEditando(null);
    setStatusPadrao(status);
    setModalOpen(true);
  }

  function abrirEditar(d: Demanda) {
    setEditando(d);
    setStatusPadrao(d.status);
    setModalOpen(true);
  }

  async function handleSalvar(dados: { titulo: string; descricao: string | null; prioridade: DemandaPrioridade; status: DemandaStatus }) {
    if (editando) {
      await onAtualizar({ id: editando.id, ...dados });
      if (dados.status !== editando.status) await onMover(editando.id, dados.status);
    } else {
      await onCriar(dados);
    }
    setModalOpen(false);
  }

  return (
    <>
      <div className={styles.board}>
        {COLUNAS.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            label={STATUS_LABELS[status]}
            demandas={porStatus[status]}
            onAdicionar={() => abrirNova(status)}
            onCardClick={abrirEditar}
            onDrop={(id) => onMover(id, status)}
          />
        ))}
      </div>

      {modalOpen && (
        <DemandaModal
          demanda={editando}
          statusPadrao={statusPadrao}
          onClose={() => setModalOpen(false)}
          onSalvar={handleSalvar}
          onRemover={editando ? async () => {
            await onRemover(editando.id);
            setModalOpen(false);
          } : undefined}
        />
      )}
    </>
  );
}
