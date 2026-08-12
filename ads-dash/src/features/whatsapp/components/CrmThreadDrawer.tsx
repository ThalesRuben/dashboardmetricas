import { useState, useEffect } from 'react';
import type { WhatsAppThreadReal, WhatsAppThreadStatusReal } from '../api/types';
import { useCrmNotas, useCrmTags, useCrmFollowups, useCrmVendas } from '../hooks/useCrm';
import styles from './CrmThreadDrawer.module.css';

const STATUS_LABEL: Record<WhatsAppThreadStatusReal, string> = {
  lead: 'Lead', aberta: 'Em atend.', agendado: 'Agendado', venda: 'Venda', arquivada: 'Arquivada',
};
const STATUS_ORDER: WhatsAppThreadStatusReal[] = ['lead', 'aberta', 'agendado', 'venda', 'arquivada'];

type Tab = 'notas' | 'tags' | 'followups' | 'vendas';

interface Props {
  thread: WhatsAppThreadReal;
  onClose: () => void;
  onChangeStatus: (novo: WhatsAppThreadStatusReal) => void;
}

export default function CrmThreadDrawer({ thread, onClose, onChangeStatus }: Props) {
  const [tab, setTab] = useState<Tab>('notas');

  // Esc pra fechar
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nome = thread.contato_nome || thread.contato_phone || '—';

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside className={styles.drawer} onClick={e => e.stopPropagation()} role="dialog" aria-label={`CRM de ${nome}`}>
        <header className={styles.header}>
          <div className={styles.avatar}>{nome.slice(0, 1).toUpperCase()}</div>
          <div className={styles.headerBody}>
            <span className={styles.nome}>{nome}</span>
            <span className={styles.phone}>{thread.contato_phone}</span>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className={styles.statusRow} role="group" aria-label="Mover para status">
          {STATUS_ORDER.map(s => (
            <button
              key={s}
              type="button"
              className={`${styles.statusBtn} ${thread.status === s ? styles.statusBtnActive : ''}`}
              onClick={() => onChangeStatus(s)}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <nav className={styles.tabs}>
          {(['notas', 'tags', 'followups', 'vendas'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'notas' ? 'Notas'
                : t === 'tags' ? 'Tags'
                : t === 'followups' ? 'Follow-ups'
                : 'Vendas'}
            </button>
          ))}
        </nav>

        <div className={styles.body}>
          {tab === 'notas'     && <NotasTab threadId={thread.id} />}
          {tab === 'tags'      && <TagsTab threadId={thread.id} />}
          {tab === 'followups' && <FollowupsTab threadId={thread.id} />}
          {tab === 'vendas'    && <VendasTab threadId={thread.id} />}
        </div>
      </aside>
    </div>
  );
}

function NotasTab({ threadId }: { threadId: string }) {
  const { notas, criar, remover } = useCrmNotas(threadId);
  const [texto, setTexto] = useState('');

  async function submit() {
    if (!texto.trim()) return;
    await criar(texto);
    setTexto('');
  }

  return (
    <>
      <div className={styles.notaForm}>
        <textarea
          className={styles.notaInput}
          placeholder="Anote algo sobre esse cliente…"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
          }}
        />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={submit} disabled={!texto.trim()}>
            Adicionar nota
          </button>
        </div>
      </div>

      {notas.length === 0 && <p className={styles.empty}>Nenhuma nota ainda.</p>}
      {notas.map(n => (
        <article key={n.id} className={styles.notaItem}>
          <p className={styles.notaTexto}>{n.texto}</p>
          <div className={styles.notaMeta}>
            <span>{fmtData(n.criado_em)}</span>
            <button type="button" className={styles.removeBtn} onClick={() => remover(n.id)}>remover</button>
          </div>
        </article>
      ))}
    </>
  );
}

function TagsTab({ threadId }: { threadId: string }) {
  const { tagsGlobais, tagsDaThread, criarTag, aplicar, remover } = useCrmTags(threadId);
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState('#5dcaa5');

  const disponiveis = tagsGlobais.filter(t => !tagsDaThread.some(tt => tt.id === t.id));

  async function criarEAplicar() {
    if (!novoNome.trim()) return;
    const t = await criarTag(novoNome.trim(), novaCor);
    await aplicar(t.id);
    setNovoNome('');
  }

  return (
    <>
      <h4 className={styles.sectionTitle}>Aplicadas</h4>
      <div className={styles.tagsAtivas}>
        {tagsDaThread.length === 0 && <p className={styles.empty}>Nenhuma tag ainda.</p>}
        {tagsDaThread.map(t => (
          <span key={t.id} className={styles.tagAtiva} style={{ background: t.cor }}>
            {t.nome}
            <button type="button" className={styles.tagRemove} onClick={() => remover(t.id)} aria-label={`Remover ${t.nome}`}>×</button>
          </span>
        ))}
      </div>

      <h4 className={styles.sectionTitle}>Disponíveis</h4>
      <div className={styles.tagsDisp}>
        {disponiveis.length === 0 && <p className={styles.empty}>Nada pra adicionar. Crie uma abaixo.</p>}
        {disponiveis.map(t => (
          <button key={t.id} type="button" className={styles.tagBtn} onClick={() => aplicar(t.id)}>
            + {t.nome}
          </button>
        ))}
      </div>

      <h4 className={styles.sectionTitle}>Criar tag</h4>
      <div className={styles.novaTag}>
        <input
          className={styles.novaTagInput}
          placeholder="Ex: VIP, corte, coloração…"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criarEAplicar(); } }}
        />
        <input
          type="color"
          value={novaCor}
          onChange={e => setNovaCor(e.target.value)}
          style={{ width: 34, height: 30, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
          aria-label="Cor da tag"
        />
        <button type="button" className={styles.primary} onClick={criarEAplicar} disabled={!novoNome.trim()}>
          Criar
        </button>
      </div>
    </>
  );
}

function FollowupsTab({ threadId }: { threadId: string }) {
  const { followups, criar, marcarFeito, remover } = useCrmFollowups(threadId);
  const [data, setData] = useState('');
  const [motivo, setMotivo] = useState('');

  async function submit() {
    if (!data) return;
    // datetime-local não tem timezone; assume horário local do usuário.
    const iso = new Date(data).toISOString();
    await criar(iso, motivo || null);
    setData(''); setMotivo('');
  }

  return (
    <>
      <div className={styles.followupForm}>
        <input
          type="datetime-local"
          value={data}
          onChange={e => setData(e.target.value)}
        />
        <input
          placeholder="Responsável / hora"
          value={motivo.split('\n')[0] || ''}
          onChange={e => setMotivo(e.target.value)}
          style={{ display: 'none' }}  // simplifica: só um textarea abaixo
          aria-hidden
        />
        <textarea
          placeholder="Motivo (opcional). Ex: confirmar horário do sábado às 15h."
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
        />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={submit} disabled={!data}>
            Agendar follow-up
          </button>
        </div>
      </div>

      {followups.length === 0 && <p className={styles.empty}>Nenhum follow-up agendado.</p>}
      {followups.map(f => {
        const atrasado = !f.feito && new Date(f.data) < new Date();
        return (
          <article
            key={f.id}
            className={`${styles.followupItem} ${atrasado ? styles.followupItemAtrasado : ''} ${f.feito ? styles.followupItemFeito : ''}`}
          >
            <div className={styles.followupBody}>
              <span className={styles.followupData}>
                {fmtDataHora(f.data)} {f.feito ? '· ✓ feito' : atrasado ? '· atrasado' : ''}
              </span>
              {f.motivo && <span className={styles.followupMotivo}>{f.motivo}</span>}
            </div>
            {!f.feito && (
              <button type="button" className={styles.chkBtn} onClick={() => marcarFeito(f.id)}>marcar feito</button>
            )}
            <button type="button" className={styles.removeBtn} onClick={() => remover(f.id)}>×</button>
          </article>
        );
      })}
    </>
  );
}

function VendasTab({ threadId }: { threadId: string }) {
  const { vendas, registrar, remover } = useCrmVendas(threadId);
  const [servico, setServico] = useState('');
  const [valor, setValor] = useState('');
  const [obs, setObs] = useState('');

  async function submit() {
    const num = parseFloat(valor.replace(',', '.'));
    if (!servico.trim() || !num || num <= 0) return;
    await registrar({
      servico: servico.trim(),
      valor_cents: Math.round(num * 100),
      observacao: obs || null,
    });
    setServico(''); setValor(''); setObs('');
  }

  const total = vendas.reduce((a, v) => a + v.valor_cents, 0);

  return (
    <>
      <div className={styles.vendaForm}>
        <input
          placeholder="Serviço (ex: mechas + corte)"
          value={servico}
          onChange={e => setServico(e.target.value)}
        />
        <input
          placeholder="Valor R$"
          inputMode="decimal"
          value={valor}
          onChange={e => setValor(e.target.value)}
        />
        <textarea
          placeholder="Observação (opcional)"
          value={obs}
          onChange={e => setObs(e.target.value)}
        />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={submit} disabled={!servico.trim() || !valor}>
            Registrar venda
          </button>
        </div>
      </div>

      {vendas.length === 0 && <p className={styles.empty}>Nenhuma venda registrada.</p>}
      {vendas.length > 0 && (
        <p className={styles.notaMeta} style={{ padding: '0 4px' }}>
          Total: <strong style={{ color: '#5dcaa5' }}>{fmtMoeda(total)}</strong> em {vendas.length} venda{vendas.length > 1 ? 's' : ''}
        </p>
      )}
      {vendas.map(v => (
        <article key={v.id} className={styles.vendaItem}>
          <div className={styles.vendaBody}>
            <span className={styles.vendaServico}>{v.servico}</span>
            <span className={styles.vendaMeta}>
              {fmtDataBR(v.data)}{v.observacao ? ` · ${v.observacao}` : ''}
            </span>
          </div>
          <span className={styles.vendaValor}>{fmtMoeda(v.valor_cents)}</span>
          <button type="button" className={styles.removeBtn} onClick={() => remover(v.id)}>×</button>
        </article>
      ))}
    </>
  );
}

function fmtMoeda(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}
function fmtDataHora(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}
function fmtDataBR(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y?.slice(2)}`;
}
