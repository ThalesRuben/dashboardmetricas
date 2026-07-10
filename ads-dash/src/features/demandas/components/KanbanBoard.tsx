import { useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import type {
  Demanda,
  DemandaFiltro,
  DemandaStatus,
  DemandaPrioridade,
  TeamMember,
} from '../api/types';
import { STATUS_LABELS } from '../api/types';
import KanbanColumn from './KanbanColumn';
import DemandaModal from './DemandaModal';
import styles from './KanbanBoard.module.css';

interface Props {
  porStatus: Record<DemandaStatus, Demanda[]>;
  equipe: TeamMember[];
  onCriar: (input: { titulo: string; descricao?: string | null; status?: DemandaStatus; prioridade?: DemandaPrioridade; responsavel_id?: string | null; prazo?: string | null }) => Promise<void>;
  onAtualizar: (input: { id: string; titulo?: string; descricao?: string | null; prioridade?: DemandaPrioridade; responsavel_id?: string | null; prazo?: string | null }) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
  onMover: (id: string, status: DemandaStatus) => Promise<void>;
}

const COLUNAS: DemandaStatus[] = ['backlog', 'fazendo', 'feito'];

export default function KanbanBoard({ porStatus, equipe, onCriar, onAtualizar, onRemover, onMover }: Props) {
  const { user } = useAuth() as { user: { id: string } | null };
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Demanda | null>(null);
  const [statusPadrao, setStatusPadrao] = useState<DemandaStatus>('backlog');
  const [filtro, setFiltro] = useState<DemandaFiltro>({ tipo: 'todas' });

  function passaFiltro(d: Demanda): boolean {
    if (filtro.tipo === 'todas') return true;
    if (filtro.tipo === 'minhas') return !!user && d.responsavel_id === user.id;
    return d.responsavel_id === filtro.pessoaId;
  }

  const porStatusFiltrado = useMemo(() => {
    const buckets: Record<DemandaStatus, Demanda[]> = { backlog: [], fazendo: [], feito: [] };
    for (const s of COLUNAS) buckets[s] = porStatus[s].filter(passaFiltro);
    return buckets;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porStatus, filtro, user?.id]);

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

  async function handleSalvar(dados: { titulo: string; descricao: string | null; prioridade: DemandaPrioridade; status: DemandaStatus; responsavel_id: string | null; prazo: string | null }) {
    if (editando) {
      await onAtualizar({
        id: editando.id,
        titulo: dados.titulo,
        descricao: dados.descricao,
        prioridade: dados.prioridade,
        responsavel_id: dados.responsavel_id,
        prazo: dados.prazo,
      });
      if (dados.status !== editando.status) await onMover(editando.id, dados.status);
    } else {
      await onCriar(dados);
    }
    setModalOpen(false);
  }

  const pessoaAtual = filtro.tipo === 'pessoa' ? filtro.pessoaId : '';

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.filtroGrupo} role="group" aria-label="Filtrar demandas">
          <button
            type="button"
            className={`${styles.filtroBtn} ${filtro.tipo === 'todas' ? styles.filtroBtnAtivo : ''}`}
            onClick={() => setFiltro({ tipo: 'todas' })}
          >
            Todas
          </button>
          <button
            type="button"
            className={`${styles.filtroBtn} ${filtro.tipo === 'minhas' ? styles.filtroBtnAtivo : ''}`}
            onClick={() => setFiltro({ tipo: 'minhas' })}
            disabled={!user}
          >
            Minhas
          </button>
          <select
            className={styles.filtroSelect}
            value={pessoaAtual}
            onChange={e => {
              const v = e.target.value;
              setFiltro(v ? { tipo: 'pessoa', pessoaId: v } : { tipo: 'todas' });
            }}
            aria-label="Filtrar por responsável"
          >
            <option value="">Por pessoa…</option>
            {equipe.map(m => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.board}>
        {COLUNAS.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            label={STATUS_LABELS[status]}
            demandas={porStatusFiltrado[status]}
            equipe={equipe}
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
          equipe={equipe}
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
