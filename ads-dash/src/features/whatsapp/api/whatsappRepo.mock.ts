// Implementação mock — dataset de demonstração do WhatsApp (canal CTWA + orgânico).

import type { WhatsAppRepo } from './whatsappRepo';
import type { WhatsAppSummary } from './types';

const MOCK: WhatsAppSummary = {
  resumo: {
    conversas: 312,        conversas_delta: 11.4,
    leads: 168,            leads_delta: 8.2,
    agendamentos: 74,      agendamentos_delta: 15.6,
    taxa_resposta: 94.2,   tempo_resposta_min: 6,
    taxa_conversao: 23.7,  ticket_medio: 240,
  },
  funil: [
    { etapa: 'Mensagens recebidas', valor: 1340 },
    { etapa: 'Respondidas',          valor: 1262 },
    { etapa: 'Conversas qualificadas (leads)', valor: 168 },
    { etapa: 'Agendamentos',         valor: 74 },
    { etapa: 'Vendas concluídas',    valor: 51 },
  ],
  serie_conversas: [
    { date: 'Seg', value: 38 }, { date: 'Ter', value: 52 },
    { date: 'Qua', value: 61 }, { date: 'Qui', value: 47 },
    { date: 'Sex', value: 68 }, { date: 'Sáb', value: 31 },
    { date: 'Dom', value: 15 },
  ],
  serie_conversao: [
    { date: '01/05', value: 19.2 }, { date: '08/05', value: 21.1 },
    { date: '15/05', value: 22.8 }, { date: '19/05', value: 23.7 },
  ],
  motivos: [
    { motivo: 'Agendar horário',          total: 124, pct: 39.7, tag: 'quente' },
    { motivo: 'Preço / tabela de valores', total: 78, pct: 25.0, tag: 'quente' },
    { motivo: 'Dúvida sobre procedimento', total: 54, pct: 17.3, tag: 'morno' },
    { motivo: 'Reagendar / cancelar',       total: 31, pct: 9.9,  tag: 'frio'  },
    { motivo: 'Outros',                     total: 25, pct: 8.0,  tag: 'frio'  },
  ],
  origens: [
    { origem: 'Anúncio Meta (CTWA)', conversas: 142, pct: 45.5 },
    { origem: 'Instagram orgânico',  conversas: 86,  pct: 27.6 },
    { origem: 'Google / site',       conversas: 51,  pct: 16.3 },
    { origem: 'Indicação / direto',  conversas: 33,  pct: 10.6 },
  ],
  conversas_recentes: [
    {
      id: 'c1',
      nome: 'Marina Alves',
      resumo: 'Quer agendar mechas pro fim de semana',
      status: 'lead',
      hora: '14:32',
      origem: 'Anúncio Meta',
      telefone: '+55 11 98432-1100',
      nao_lidas: 2,
      mensagens: [
        { autor: 'cliente',   texto: 'Oi! Vi o anúncio de vocês no Instagram, fazem mechas iluminadas?', hora: '14:18' },
        { autor: 'atendente', texto: 'Oi Marina! Fazemos sim 💛 trabalhamos com mechas iluminadas, balayage e morena iluminada.', hora: '14:21' },
        { autor: 'cliente',   texto: 'Quanto fica e tem horário pra sábado?', hora: '14:27' },
        { autor: 'cliente',   texto: 'Meu cabelo é castanho médio, na altura do ombro', hora: '14:32' },
      ],
    },
    {
      id: 'c2',
      nome: 'Patrícia Gomes',
      resumo: 'Perguntou valor da progressiva',
      status: 'aberta',
      hora: '13:58',
      origem: 'Instagram',
      telefone: '+55 11 99021-4488',
      nao_lidas: 1,
      mensagens: [
        { autor: 'cliente',   texto: 'Boa tarde, vocês fazem progressiva sem formol?',  hora: '13:42' },
        { autor: 'atendente', texto: 'Boa tarde Patrícia! Sim, trabalhamos só com progressiva sem formol.', hora: '13:50' },
        { autor: 'cliente',   texto: 'E qual o valor? Cabelo na cintura', hora: '13:58' },
      ],
    },
    {
      id: 'c3',
      nome: 'Júlia Ramos',
      resumo: 'Confirmou horário de quinta 15h',
      status: 'agendado',
      hora: '13:10',
      origem: 'Anúncio Meta',
      telefone: '+55 11 98765-0033',
      nao_lidas: 0,
      mensagens: [
        { autor: 'atendente', texto: 'Oi Júlia, confirmando seu horário de quinta 15h pra corte + escova ✨', hora: '12:55' },
        { autor: 'cliente',   texto: 'Confirmado! Obrigada 🙏', hora: '13:10' },
      ],
    },
    {
      id: 'c4',
      nome: 'Carla Souza',
      resumo: 'Reagendou corte para próxima semana',
      status: 'aberta',
      hora: '11:45',
      origem: 'Google',
      telefone: '+55 11 97654-2210',
      nao_lidas: 0,
      mensagens: [
        { autor: 'cliente',   texto: 'Bom dia, preciso reagendar meu corte de hoje 😔',                hora: '11:30' },
        { autor: 'atendente', texto: 'Bom dia Carla! Sem problemas. Tenho terça 10h ou quarta 16h.', hora: '11:38' },
        { autor: 'cliente',   texto: 'Quarta 16h fica perfeito',                                       hora: '11:45' },
      ],
    },
    {
      id: 'c5',
      nome: 'Bianca Lima',
      resumo: 'Fechou pacote noiva — R$ 980',
      status: 'venda',
      hora: '10:22',
      origem: 'Indicação',
      telefone: '+55 11 99887-1122',
      nao_lidas: 0,
      mensagens: [
        { autor: 'cliente',   texto: 'A Letícia me indicou vocês pro casamento ❤️',                 hora: '09:40' },
        { autor: 'atendente', texto: 'Que maravilha Bianca! Quando é o grande dia?',                hora: '09:48' },
        { autor: 'cliente',   texto: '15 de agosto. Quero make + cabelo + ensaio',                   hora: '09:55' },
        { autor: 'atendente', texto: 'Temos o pacote Noiva Premium por R$ 980 (cabelo + make + 1 ensaio).', hora: '10:08' },
        { autor: 'cliente',   texto: 'Fechado! Como faço o sinal?',                                  hora: '10:22' },
      ],
    },
    {
      id: 'c6',
      nome: 'Renata Fonseca',
      resumo: 'Dúvida sobre coloração antes de viagem',
      status: 'lead',
      hora: '09:51',
      origem: 'Instagram',
      telefone: '+55 11 98112-9080',
      nao_lidas: 3,
      mensagens: [
        { autor: 'cliente',   texto: 'Oi, viajo dia 28 e queria mudar o cabelo antes',  hora: '09:33' },
        { autor: 'cliente',   texto: 'Pensei numa morena iluminada',                    hora: '09:34' },
        { autor: 'cliente',   texto: 'Vocês têm horário semana que vem?',               hora: '09:51' },
      ],
    },
  ],
};

// Histórico in-memory (perde no refresh; o que importa é validar o fluxo).
const DISPAROS_MEM: import('./types').WhatsAppDisparoHistorico[] = [];

export const mockWhatsAppRepo: WhatsAppRepo = {
  async getSummary() {
    return MOCK;
  },
  async enviarDisparo(input) {
    const total = input.recipients.length;
    const resultados = input.recipients.map(r => ({
      phone: r.phone,
      ok: true,
      id: 'mock-' + Math.random().toString(36).slice(2, 9),
    }));
    DISPAROS_MEM.unshift({
      id: crypto.randomUUID(),
      template_name: input.rotulo,
      template_lang: 'pt_BR',
      variables: input.variables || [],
      total,
      enviados: total,
      falhas: 0,
      status: 'concluido',
      criado_em: new Date().toISOString(),
    });
    return {
      message: 'Mock: disparo simulado (modo demonstração).',
      dry_run: true,
      sem_config: true,
      total,
      enviados: total,
      falhas: 0,
      resultados,
    };
  },
  async listarDisparos(limit = 20) {
    return DISPAROS_MEM.slice(0, limit);
  },

  // Inbox real → no mock, derivamos das conversas_recentes do summary.
  // inbox_phone alterna entre os 2 números canônicos do salão, pra UI
  // ter chips reais no modo demonstração.
  async listarThreads(limit = 20) {
    const MOCK_INBOXES = ['5531990842381', '5531991340420']
    return MOCK.conversas_recentes.slice(0, limit).map((c, i) => ({
      id: c.id || crypto.randomUUID(),
      contato_id: c.id || crypto.randomUUID(),
      contato_nome: c.nome,
      contato_phone: (c.telefone || '').replace(/\D/g, ''),
      status: c.status as any,
      origem: c.origem,
      nao_lidas: c.nao_lidas || 0,
      ultima_atividade: new Date().toISOString(),
      ultima_msg_cliente_em: new Date().toISOString(),
      ultima_msg_preview:
        c.mensagens && c.mensagens.length > 0
          ? c.mensagens[c.mensagens.length - 1].texto
          : c.resumo,
      inbox_phone: MOCK_INBOXES[i % MOCK_INBOXES.length],
    }));
  },

  async listarInboxes() {
    return [
      { inbox_phone: '5531990842381', threads: 4, ultima_atividade: new Date().toISOString() },
      { inbox_phone: '5531991340420', threads: 2, ultima_atividade: new Date().toISOString() },
    ]
  },

  async listarMsgs(threadId: string) {
    const c = MOCK.conversas_recentes.find((x) => x.id === threadId);
    if (!c) return [];
    const baseHora = new Date();
    return (c.mensagens || []).map((m, i) => ({
      id: `${threadId}-${i}`,
      thread_id: threadId,
      autor: m.autor,
      texto: m.texto,
      status: 'entregue' as const,
      hora: new Date(baseHora.getTime() - (c.mensagens!.length - i) * 60_000).toISOString(),
      msg_id_externo: null,
    }));
  },

  // No mock contato_id === thread.id (1 thread por contato), então delega.
  async listarMsgsPorContato(contatoId: string) {
    return this.listarMsgs(contatoId);
  },

  async listarMsgsPorContatos(contatoIds: string[]) {
    const all = await Promise.all(contatoIds.map((id) => this.listarMsgs(id)));
    return all.flat().sort((a, b) => (a.hora < b.hora ? -1 : 1));
  },

  async enviarResposta() {
    return { ok: true, sem_config: true };
  },

  async marcarLido() {
    /* noop no mock */
  },

  async marcarLidoContato() {
    /* noop no mock */
  },

  async marcarLidoContatos() {
    /* noop no mock */
  },
};

export { MOCK as MOCK_WHATSAPP };
