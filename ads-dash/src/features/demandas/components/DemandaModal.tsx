import { useEffect, useState } from 'react';
import type { Demanda, DemandaPrioridade, DemandaStatus } from '../api/types';
import { PRIORIDADE_LABELS, STATUS_LABELS } from '../api/types';
import styles from './DemandaModal.module.css';

interface Props {
  demanda: Demanda | null;
  statusPadrao: DemandaStatus;
  onClose: () => void;
  onSalvar: (dados: {
    titulo: string;
    descricao: string | null;
    prioridade: DemandaPrioridade;
    status: DemandaStatus;
  }) => Promise<void>;
  onRemover?: () => Promise<void>;
}

const STATUS_OPTS: DemandaStatus[] = ['backlog', 'fazendo', 'feito'];
const PRIO_OPTS: DemandaPrioridade[] = ['baixa', 'media', 'alta'];

export default function DemandaModal({ demanda, statusPadrao, onClose, onSalvar, onRemover }: Props) {
  const [titulo, setTitulo] = useState(demanda?.titulo ?? '');
  const [descricao, setDescricao] = useState(demanda?.descricao ?? '');
  const [prioridade, setPrioridade] = useState<DemandaPrioridade>(demanda?.prioridade ?? 'media');
  const [status, setStatus] = useState<DemandaStatus>(demanda?.status ?? statusPadrao);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || saving) return;
    setSaving(true);
    try {
      await onSalvar({
        titulo: titulo.trim(),
        descricao: descricao.trim() ? descricao.trim() : null,
        prioridade,
        status,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <header className={styles.head}>
          <h2>{demanda ? 'Editar demanda' : 'Nova demanda'}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Título</span>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="O que precisa ser feito?"
              autoFocus
              required
            />
          </label>

          <label className={styles.field}>
            <span>Descrição</span>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Contexto, links, critério de aceite…"
              rows={4}
            />
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span>Status</span>
              <select value={status} onChange={e => setStatus(e.target.value as DemandaStatus)}>
                {STATUS_OPTS.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Prioridade</span>
              <select value={prioridade} onChange={e => setPrioridade(e.target.value as DemandaPrioridade)}>
                {PRIO_OPTS.map(p => (
                  <option key={p} value={p}>{PRIORIDADE_LABELS[p]}</option>
                ))}
              </select>
            </label>
          </div>

          <footer className={styles.footer}>
            {onRemover && (
              <button
                type="button"
                className={styles.remove}
                onClick={async () => {
                  if (confirm('Remover esta demanda?')) await onRemover();
                }}
              >
                Remover
              </button>
            )}
            <div className={styles.footerRight}>
              <button type="button" className={styles.cancel} onClick={onClose}>Cancelar</button>
              <button type="submit" className={styles.save} disabled={saving || !titulo.trim()}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
