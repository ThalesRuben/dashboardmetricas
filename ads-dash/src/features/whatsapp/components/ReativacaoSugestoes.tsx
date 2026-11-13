import { useState } from 'react';
import { invokeFunction } from '@/shared/lib/supabase';
import { useToast } from '@/app/providers/ToastContext';
import { coachRascunhosRepo, type CoachRascunho } from '../api/coachRascunhosRepo';
import { useCoachRascunhos } from '../hooks/useCoachRascunhos';
import { whatsappRepo } from '../api/whatsappRepo';
import type { WhatsAppMsgReal } from '../api/types';
import styles from './ReativacaoSugestoes.module.css';

function fmtMsgTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function fmtAgo(iso: string): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.round(diffMs / 3600000);
  if (h < 48) return `${h}h atrás`;
  const d = Math.round(h / 24);
  return `${d}d atrás`;
}

function scoreClass(score: number): string {
  if (score >= 75) return styles.scoreQuente;
  if (score >= 45) return styles.scoreMorno;
  return styles.scoreFrio;
}

function TagBadge({ tag }: { tag: CoachRascunho['tag_sugerida'] }) {
  const cls = tag === 'quente' ? styles.tagQuente : tag === 'morno' ? styles.tagMorno : styles.tagFrio;
  return <span className={`${styles.tag} ${cls}`}>{tag}</span>;
}

export default function ReativacaoSugestoes() {
  const toast = useToast();
  const { rascunhos, loading, erro, recarregar, removerLocal } = useCoachRascunhos();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [transcricoes, setTranscricoes] = useState<Record<string, WhatsAppMsgReal[]>>({});
  const [carregandoTranscricao, setCarregandoTranscricao] = useState<Record<string, boolean>>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  async function toggleTranscricao(r: CoachRascunho) {
    const jaAberto = abertos[r.id];
    if (jaAberto) {
      setAbertos((a) => ({ ...a, [r.id]: false }));
      return;
    }
    setAbertos((a) => ({ ...a, [r.id]: true }));
    // Carrega só na primeira vez
    if (transcricoes[r.id]) return;
    setCarregandoTranscricao((c) => ({ ...c, [r.id]: true }));
    try {
      const msgs = await whatsappRepo.listarMsgs(r.thread_id, 200);
      setTranscricoes((t) => ({ ...t, [r.id]: msgs }));
    } catch {
      toast.error('Falha ao carregar conversa.');
    } finally {
      setCarregandoTranscricao((c) => ({ ...c, [r.id]: false }));
    }
  }

  function textoDe(r: CoachRascunho): string {
    return edits[r.id] ?? r.mensagem_sugerida;
  }

  async function aprovarEEnviar(r: CoachRascunho) {
    const texto = textoDe(r).trim();
    if (!texto) { toast.error('Texto vazio.'); return; }
    setBusyId(r.id);
    try {
      const { data, error } = await invokeFunction<any>('inbox-reply', {
        thread_id: r.thread_id,
        texto,
      });
      if (error) {
        // supabase.functions.invoke só expõe uma msg genérica — tenta puxar o
        // corpo JSON da resposta pra ver o motivo real (Z-API, 404, etc).
        const ctx = (error as any).context;
        let detalhe = (error as any).message || 'Falha no envio.';
        if (ctx?.response) {
          try {
            const corpo = await ctx.response.json();
            detalhe = corpo?.detalhe || corpo?.error || corpo?.message || detalhe;
          } catch { /* mantém detalhe genérico */ }
        }
        await coachRascunhosRepo.marcarFalho(r.id, detalhe).catch(() => {});
        toast.error(`Erro ao enviar: ${detalhe}`);
        return;
      }
      await coachRascunhosRepo.marcarEnviado(r.id, texto, data?.msg_id ?? null);
      removerLocal(r.id);
      toast.success(`Mensagem enviada pra ${r.contato_nome || r.contato_phone}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao aprovar.');
    } finally {
      setBusyId(null);
    }
  }

  async function descartar(r: CoachRascunho) {
    if (!confirm('Descartar essa sugestão?')) return;
    setBusyId(r.id);
    try {
      await coachRascunhosRepo.descartar(r.id);
      removerLocal(r.id);
      toast.success('Rascunho descartado.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao descartar.');
    } finally {
      setBusyId(null);
    }
  }

  async function blacklist(r: CoachRascunho) {
    const motivo = prompt(`Adicionar ${r.contato_phone} na blacklist (não gera mais rascunho automático). Motivo (opcional):`);
    if (motivo === null) return;
    setBusyId(r.id);
    try {
      await coachRascunhosRepo.blacklistTelefone(r.contato_phone, motivo || null);
      await coachRascunhosRepo.descartar(r.id);
      removerLocal(r.id);
      toast.success('Telefone adicionado na blacklist.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao marcar.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className={styles.loading}>Carregando rascunhos...</div>;
  if (erro) return <div className={styles.err}>{erro}</div>;

  const quentes = rascunhos.filter((r) => r.tag_sugerida === 'quente');
  const mornos = rascunhos.filter((r) => r.tag_sugerida === 'morno');

  if (!rascunhos.length) {
    return (
      <div className={styles.empty}>
        <h3>Nada pra revisar agora 💛</h3>
        <p>
          A IA varre leads dormentes 2x por dia e enfileira sugestões aqui.
          Só precisa clicar <strong>Aprovar e enviar</strong> (ou editar antes).
          Nada vai pra cliente sem sua aprovação.
        </p>
        <button className="cc-btn" onClick={recarregar}>↻ Verificar novamente</button>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h3 className={styles.title}>
          <span className={styles.titleIcon}>AI</span>
          Reativações sugeridas · {rascunhos.length}
        </h3>
        <div className={styles.headActions}>
          {quentes.length > 0 && <span className={styles.chipQuente}>{quentes.length} quente{quentes.length > 1 ? 's' : ''}</span>}
          {mornos.length > 0 && <span className={styles.chipMorno}>{mornos.length} morno{mornos.length > 1 ? 's' : ''}</span>}
          <button className="cc-btn" onClick={recarregar}>↻ Atualizar</button>
        </div>
      </div>
      <p className={styles.hint}>
        A IA leu a conversa inteira e sugeriu uma reativação. Revise, edite se precisar, e aprove.
        Mensagens só saem daqui depois que você clicar em aprovar.
      </p>

      <div className={styles.list}>
        {rascunhos.map((r) => (
          <article key={r.id} className={styles.card}>
            <header className={styles.cardHead}>
              <div className={styles.cardWho}>
                <strong>{r.contato_nome || r.contato_phone}</strong>
                <span className={styles.cardMeta}>
                  {r.contato_phone} · {fmtAgo(r.thread_ultima_atividade)} · status {r.thread_status}
                </span>
              </div>
              <div className={styles.cardTags}>
                <span className={`${styles.score} ${scoreClass(r.score_lead)}`}>
                  <span className={styles.scoreLabel}>score</span>
                  <span className={styles.scoreValue}>{r.score_lead}</span>
                </span>
                <TagBadge tag={r.tag_sugerida} />
              </div>
            </header>

            {r.resumo_ia && <p className={styles.resumo}>{r.resumo_ia}</p>}

            <button
              type="button"
              className={styles.verConversa}
              onClick={() => toggleTranscricao(r)}
              aria-expanded={!!abertos[r.id]}
            >
              {abertos[r.id] ? '▾ Esconder conversa' : '▸ Ver conversa completa'}
            </button>

            {abertos[r.id] && (
              <div className={styles.transcricao}>
                {carregandoTranscricao[r.id] ? (
                  <p className={styles.transcricaoLoading}>Carregando mensagens...</p>
                ) : (transcricoes[r.id] ?? []).length === 0 ? (
                  <p className={styles.transcricaoLoading}>Sem mensagens.</p>
                ) : (
                  <>
                    <p className={styles.transcricaoInfo}>
                      {(transcricoes[r.id] ?? []).length} mensagens · ordem cronológica
                    </p>
                    <ol className={styles.msgList}>
                      {(transcricoes[r.id] ?? []).map((m) => (
                        <li
                          key={m.id}
                          className={`${styles.msg} ${m.autor === 'cliente' ? styles.msgCliente : styles.msgAtendente}`}
                        >
                          <span className={styles.msgAutor}>
                            {m.autor === 'cliente' ? 'Cliente' : 'Atendente'}
                          </span>
                          <span className={styles.msgTexto}>{m.texto || '[sem texto]'}</span>
                          <span className={styles.msgHora}>{fmtMsgTime(m.hora)}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            )}

            <textarea
              className={styles.textarea}
              rows={3}
              value={textoDe(r)}
              onChange={(e) => setEdits((ed) => ({ ...ed, [r.id]: e.target.value }))}
              aria-label={`Mensagem sugerida para ${r.contato_nome || r.contato_phone}`}
            />

            <div className={styles.actions}>
              <button
                className="cc-btn cc-btn--solid"
                onClick={() => aprovarEEnviar(r)}
                disabled={busyId === r.id}
              >
                {busyId === r.id ? 'Enviando...' : '▸ Aprovar e enviar'}
              </button>
              <button className="cc-btn" onClick={() => descartar(r)} disabled={busyId === r.id}>
                Descartar
              </button>
              <button className={styles.btnGhost} onClick={() => blacklist(r)} disabled={busyId === r.id}>
                Nunca mais esse número
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
