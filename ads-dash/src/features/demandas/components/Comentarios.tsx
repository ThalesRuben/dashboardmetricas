import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/providers/AuthContext';
import { demandasRepo } from '../api/demandasRepo';
import type { DemandaComentario, TeamMember } from '../api/types';
import { colorForMember, initialsForMember } from './memberColors';
import styles from './Comentarios.module.css';

interface Props {
  demandaId: string;
  equipe: TeamMember[];
}

function formatarQuando(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const horas = Math.round(mins / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `há ${dias}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function Comentarios({ demandaId, equipe }: Props) {
  const { user } = useAuth() as { user: { id: string } | null };
  const [comentarios, setComentarios] = useState<DemandaComentario[]>([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await demandasRepo.listarComentarios(demandaId);
      setComentarios(lista);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar comentários.');
    } finally {
      setLoading(false);
    }
  }, [demandaId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function enviar() {
    const clean = texto.trim();
    if (!clean || enviando) return;
    setEnviando(true);
    try {
      const novo = await demandasRepo.criarComentario({ demanda_id: demandaId, texto: clean });
      setComentarios(prev => [...prev, novo]);
      setTexto('');
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar comentário.');
    } finally {
      setEnviando(false);
    }
  }

  async function remover(id: string) {
    if (!confirm('Remover este comentário?')) return;
    try {
      await demandasRepo.removerComentario(id);
      setComentarios(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao remover.');
    }
  }

  function nomeAutor(autorId: string | null): string {
    if (!autorId) return 'Removido';
    const m = equipe.find(x => x.id === autorId);
    return m?.full_name || 'Alguém da equipe';
  }

  return (
    <section className={styles.wrapper}>
      <header className={styles.head}>
        <span className={styles.titulo}>Comentários</span>
        {comentarios.length > 0 && <span className={styles.count}>{comentarios.length}</span>}
      </header>

      {loading ? (
        <p className={styles.loading}>Carregando…</p>
      ) : (
        <div className={styles.lista}>
          {comentarios.length === 0 && (
            <p className={styles.empty}>Nenhum comentário ainda. Puxa o assunto.</p>
          )}
          {comentarios.map(c => {
            const podeRemover = !!user && c.autor_id === user.id;
            const nome = nomeAutor(c.autor_id);
            return (
              <div key={c.id} className={styles.item}>
                <span className={styles.avatar} style={{ background: colorForMember(c.autor_id || '') }}>
                  {initialsForMember(nome)}
                </span>
                <div className={styles.body}>
                  <div className={styles.meta}>
                    <span className={styles.autor}>{nome}</span>
                    <span className={styles.quando}>{formatarQuando(c.criado_em)}</span>
                    {podeRemover && (
                      <button type="button" className={styles.removerBtn} onClick={() => remover(c.id)} aria-label="Remover comentário">
                        ×
                      </button>
                    )}
                  </div>
                  <p className={styles.texto}>{c.texto}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {erro && <p className={styles.erro}>{erro}</p>}

      <div className={styles.formulario}>
        <textarea
          className={styles.textarea}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder="Escreva um comentário…"
          rows={2}
          disabled={enviando}
        />
        <button type="button" className={styles.enviar} onClick={enviar} disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando…' : 'Comentar'}
        </button>
      </div>
    </section>
  );
}
