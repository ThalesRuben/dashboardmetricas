import type { CrmFollowupComContato } from '../api/crmTypes';
import { formatarPhoneBR } from '../lib/phone';
import styles from './FollowupsFila.module.css';

interface Props {
  followups: CrmFollowupComContato[];
  onAbrir: (threadId: string) => void;
  onMarcarFeito: (id: string) => void;
}

export default function FollowupsFila({ followups, onAbrir, onMarcarFeito }: Props) {
  if (followups.length === 0) {
    return <p className={styles.empty}>Sem follow-ups pendentes. Tudo em dia. 🎉</p>;
  }

  const atrasados = followups.filter(f => new Date(f.data) < new Date());
  const futuros = followups.filter(f => new Date(f.data) >= new Date());

  return (
    <div className={styles.wrap}>
      {atrasados.length > 0 && (
        <>
          <div className={styles.head}>
            <h3 className={styles.title}>Atrasados</h3>
            <span className={styles.count}>{atrasados.length}</span>
          </div>
          {atrasados.map(f => (
            <FollowupItem key={f.id} f={f} onAbrir={onAbrir} onMarcarFeito={onMarcarFeito} atrasado />
          ))}
        </>
      )}
      {futuros.length > 0 && (
        <>
          <div className={styles.head}>
            <h3 className={styles.title}>Próximos</h3>
            <span className={styles.count}>{futuros.length}</span>
          </div>
          {futuros.map(f => (
            <FollowupItem key={f.id} f={f} onAbrir={onAbrir} onMarcarFeito={onMarcarFeito} />
          ))}
        </>
      )}
    </div>
  );
}

function FollowupItem({
  f, onAbrir, onMarcarFeito, atrasado = false,
}: {
  f: CrmFollowupComContato;
  onAbrir: (threadId: string) => void;
  onMarcarFeito: (id: string) => void;
  atrasado?: boolean;
}) {
  const d = new Date(f.data);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvoDia = new Date(d); alvoDia.setHours(0, 0, 0, 0);
  const diffDias = Math.round((alvoDia.getTime() - hoje.getTime()) / 86400000);

  let dia: string;
  if (diffDias === 0) dia = 'HOJE';
  else if (diffDias === -1) dia = 'ONTEM';
  else if (diffDias === 1) dia = 'AMANHÃ';
  else if (diffDias < 0) dia = `${Math.abs(diffDias)}d atrás`;
  else dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const nome = f.contato_nome || (f.contato_phone ? formatarPhoneBR(f.contato_phone) : 'Contato');

  return (
    <article
      className={`${styles.item} ${atrasado ? styles.itemAtrasado : ''}`}
      onClick={() => onAbrir(f.thread_id)}
      role="button"
      tabIndex={0}
    >
      <div className={styles.data}>
        <span className={`${styles.dataDia} ${atrasado ? styles.dataAtrasada : ''}`}>{dia}</span>
        <span className={styles.dataHora}>{hora}</span>
      </div>
      <div className={styles.body}>
        <span className={styles.nome}>{nome}</span>
        {f.motivo && <span className={styles.motivo}>{f.motivo}</span>}
        <span className={styles.subMeta}>status atual: {f.thread_status}</span>
      </div>
      <button
        type="button"
        className={styles.actionBtn}
        onClick={(e) => { e.stopPropagation(); onMarcarFeito(f.id); }}
      >
        ✓ feito
      </button>
    </article>
  );
}
