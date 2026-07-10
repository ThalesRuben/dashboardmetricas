import type { DemandasRepo } from './demandasRepo';
import type { Demanda, TeamMember } from './types';

const STORAGE_KEY = 'ads-dash:demandas';

const MOCK_ME = 'mock-me';
const MOCK_TEAM: TeamMember[] = [
  { id: MOCK_ME,       full_name: 'Eu (mock)' },
  { id: 'mock-outra',  full_name: 'Outra pessoa (mock)' },
];

function ler(): Demanda[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const agora = new Date().toISOString();
  const seed: Demanda[] = [
    { id: 'seed-1', titulo: 'Configurar envio de relatório semanal',
      descricao: 'Definir dia/hora e formato do PDF.',
      status: 'backlog', prioridade: 'alta',  ordem: 1,
      criado_por: MOCK_ME, responsavel_id: MOCK_ME,
      criado_em: agora, atualizado_em: agora, concluido_em: null, prazo: null },
    { id: 'seed-2', titulo: 'Revisar copy dos anúncios de junho',
      descricao: null,
      status: 'fazendo', prioridade: 'media', ordem: 1,
      criado_por: MOCK_ME, responsavel_id: 'mock-outra',
      criado_em: agora, atualizado_em: agora, concluido_em: null, prazo: null },
    { id: 'seed-3', titulo: 'Conectar segunda linha do WhatsApp',
      descricao: 'Linha 5531991340420 falta autenticar no n8n.',
      status: 'feito',   prioridade: 'alta',  ordem: 1,
      criado_por: MOCK_ME, responsavel_id: null,
      criado_em: agora, atualizado_em: agora, concluido_em: agora, prazo: null },
  ];
  escrever(seed);
  return seed;
}

function escrever(list: Demanda[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export const mockDemandasRepo: DemandasRepo = {
  async listar() { return ler(); },

  async criar(input) {
    const list = ler();
    const agora = new Date().toISOString();
    const status = input.status ?? 'backlog';
    const nova: Demanda = {
      id: crypto.randomUUID(),
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      status,
      prioridade: input.prioridade ?? 'media',
      ordem: Date.now(),
      criado_por: MOCK_ME,
      responsavel_id: input.responsavel_id ?? null,
      criado_em: agora,
      atualizado_em: agora,
      concluido_em: status === 'feito' ? agora : null,
      prazo: input.prazo ?? null,
    };
    escrever([...list, nova]);
    return nova;
  },

  async atualizar(input) {
    const list = ler();
    const agora = new Date().toISOString();
    const next = list.map(d => {
      if (d.id !== input.id) return d;
      const proximoStatus = input.status ?? d.status;
      let concluidoEm = d.concluido_em;
      if (d.status !== 'feito' && proximoStatus === 'feito') concluidoEm = agora;
      else if (d.status === 'feito' && proximoStatus !== 'feito') concluidoEm = null;
      return {
        ...d,
        titulo:         input.titulo         ?? d.titulo,
        descricao:      input.descricao      !== undefined ? input.descricao      : d.descricao,
        status:         proximoStatus,
        prioridade:     input.prioridade     ?? d.prioridade,
        ordem:          input.ordem          ?? d.ordem,
        responsavel_id: input.responsavel_id !== undefined ? input.responsavel_id : d.responsavel_id,
        prazo:          input.prazo          !== undefined ? input.prazo          : d.prazo,
        atualizado_em:  agora,
        concluido_em:   concluidoEm,
      };
    });
    escrever(next);
  },

  async remover(id) {
    escrever(ler().filter(d => d.id !== id));
  },

  async listarEquipe() {
    return MOCK_TEAM;
  },
};
