import { useMemo, useState, type DragEvent } from 'react';
import type { WhatsAppThreadReal, WhatsAppThreadStatusReal } from '../api/types';
import type { CrmTag, CrmSummary, CrmFollowup, CrmVenda } from '../api/crmTypes';
import styles from './CrmKanban.module.css';

const COLUNAS: { id: WhatsAppThreadStatusReal; label: string }[] = [
  { id: 'lead',      label: 'Novos leads' },
  { id: 'aberta',    label: 'Em atendimento' },
  { id: 'agendado',  label: 'Agendados' },
  { id: 'venda',     label: 'Vendas' },
  { id: 'arquivada', label: 'Arquivadas' },
];

// Info extra por thread pra montar o card (tags, followup, venda).
export interface CrmCardExtras {
  tags?: CrmTag[];
  proxFollowup?: CrmFollowup | null;
  ultimaVenda?: CrmVenda | null;
}

interface Props {
  threads: WhatsAppThreadReal[];
  summary: CrmSummary | null;
  extrasPorThread?: Record<string, CrmCardExtras>;
  onOpen: (t: WhatsAppThreadReal) => void;
  onMover: (threadId: string, novoStatus: WhatsAppThreadStatusReal) => void;
}

function fmtMoeda(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function fmtHoraCurta(iso: string): string {
  try {
    const d = new Date(iso);
    const hoje = new Date();
    if (d.toDateString() === hoje.toDateString()) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch { return iso; }
}

function followupStatus(f: CrmFollowup): { texto: string; atrasado: boolean } {
  const alvo = new Date(f.data).getTime();
  const agora = Date.now();
  const diffH = Math.round((alvo - agora) / 3_600_000);
  if (diffH < 0) {
    const abs = Math.abs(diffH);
    if (abs < 24) return { texto: `retorno atrasado ${abs}h`, atrasado: true };
    return { texto: `atrasado ${Math.round(abs / 24)}d`, atrasado: true };
  }
  if (diffH < 24) return { texto: `retorno em ${diffH}h`, atrasado: false };
  return { texto: new Date(f.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), atrasado: false };
}

export default function CrmKanban({ threads, summary, extrasPorThread = {}, onOpen, onMover }: Props) {
  const porStatus = useMemo(() => {
    const b: Record<WhatsAppThreadStatusReal, WhatsAppThreadReal[]> = {
      lead: [], aberta: [], agendado: [], venda: [], arquivada: [],
    };
    for (const t of threads) b[t.status]?.push(t);
    for (const s of Object.keys(b) as WhatsAppThreadStatusReal[]) {
      b[s].sort((a, x) => (a.ultima_atividade < x.ultima_atividade ? 1 : -1));
    }
    return b;
  }, [threads]);

  return (
    <div className={styles.wrap}>
      {summary && (
        <div className={styles.kpis}>
          <Kpi
            label="Leads no período"
            value={String(summary.leads)}
            sub={`${summary.em_atendimento} em atendimento`}
          />
          <Kpi
            label="Agendados"
            value={String(summary.agendados)}
            sub="prontos pra confirmar"
          />
          <Kpi
            label="Vendas fechadas"
            value={String(summary.vendas_qtd)}
            sub={`${fmtMoeda(summary.vendas_valor_cents)} · ticket ${fmtMoeda(summary.ticket_medio_cents)}`}
          />
          <Kpi
            label="Follow-ups"
            value={String(summary.followups_pendentes)}
            sub={summary.followups_atrasados > 0 ? `${summary.followups_atrasados} atrasado(s)` : 'em dia'}
          />
        </div>
      )}

      <div className={styles.board}>
        {COLUNAS.map(col => (
          <KanbanColumn
            key={col.id}
            status={col.id}
            label={col.label}
            threads={porStatus[col.id]}
            extrasPorThread={extrasPorThread}
            onOpen={onOpen}
            onDropThread={(threadId) => onMover(threadId, col.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
      {sub && <span className={styles.kpiSub}>{sub}</span>}
    </div>
  );
}

function KanbanColumn({
  status, label, threads, extrasPorThread, onOpen, onDropThread,
}: {
  status: WhatsAppThreadStatusReal;
  label: string;
  threads: WhatsAppThreadReal[];
  extrasPorThread: Record<string, CrmCardExtras>;
  onOpen: (t: WhatsAppThreadReal) => void;
  onDropThread: (id: string) => void;
}) {
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
    if (id) onDropThread(id);
  }

  return (
    <section
      className={`${styles.column} ${hover ? styles.columnHover : ''}`}
      data-status={status}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className={styles.columnHead}>
        <span className={styles.columnLabel}>
          <span className={styles.columnDot} />
          {label}
        </span>
        <span className={styles.count}>{threads.length}</span>
      </header>

      <div className={styles.cards}>
        {threads.length === 0 && <p className={styles.empty}>Vazio.</p>}
        {threads.map(t => (
          <KanbanCard
            key={t.id}
            thread={t}
            extras={extrasPorThread[t.id]}
            onOpen={() => onOpen(t)}
          />
        ))}
      </div>
    </section>
  );
}

function KanbanCard({
  thread, extras, onOpen,
}: {
  thread: WhatsAppThreadReal;
  extras?: CrmCardExtras;
  onOpen: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const nome = thread.contato_nome || thread.contato_phone || '—';

  function handleDragStart(e: DragEvent<HTMLButtonElement>) {
    e.dataTransfer.setData('text/plain', thread.id);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
  }
  function handleDragEnd() { setDragging(false); }

  const followupInfo = extras?.proxFollowup ? followupStatus(extras.proxFollowup) : null;
  const naoLidas = thread.nao_lidas || 0;

  return (
    <button
      type="button"
      className={`${styles.card} ${dragging ? styles.dragging : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onOpen}
    >
      <div className={styles.cardTop}>
        <span className={styles.cardNome}>{nome}</span>
        <span className={styles.cardHora}>{fmtHoraCurta(thread.ultima_atividade)}</span>
      </div>
      {thread.ultima_msg_preview && (
        <p className={styles.cardPreview}>{thread.ultima_msg_preview}</p>
      )}
      <div className={styles.cardBadges}>
        {naoLidas > 0 && (
          <span className={`${styles.badge} ${styles.badgeUnread}`}>{naoLidas} nova{naoLidas > 1 ? 's' : ''}</span>
        )}
        {followupInfo && (
          <span
            className={`${styles.badge} ${followupInfo.atrasado ? styles.badgeFollowupAtrasado : styles.badgeFollowup}`}
            title={extras?.proxFollowup?.motivo || 'Follow-up agendado'}
          >
            {followupInfo.texto}
          </span>
        )}
        {extras?.ultimaVenda && (
          <span className={`${styles.badge} ${styles.badgeVenda}`}>
            {fmtMoeda(extras.ultimaVenda.valor_cents)}
          </span>
        )}
        {extras?.tags?.slice(0, 3).map(tag => (
          <span key={tag.id} className={styles.tag} style={{ background: tag.cor }}>
            {tag.nome}
          </span>
        ))}
      </div>
    </button>
  );
}
