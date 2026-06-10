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
    { nome: 'Marina Alves',   resumo: 'Quer agendar mechas pro fim de semana', status: 'lead',     hora: '14:32', origem: 'Anúncio Meta' },
    { nome: 'Patrícia Gomes', resumo: 'Perguntou valor da progressiva',          status: 'aberta',   hora: '13:58', origem: 'Instagram' },
    { nome: 'Júlia Ramos',    resumo: 'Confirmou horário de quinta 15h',          status: 'agendado', hora: '13:10', origem: 'Anúncio Meta' },
    { nome: 'Carla Souza',    resumo: 'Reagendou corte para próxima semana',      status: 'aberta',   hora: '11:45', origem: 'Google' },
    { nome: 'Bianca Lima',    resumo: 'Fechou pacote noiva — R$ 980',             status: 'venda',    hora: '10:22', origem: 'Indicação' },
  ],
};

export const mockWhatsAppRepo: WhatsAppRepo = {
  async getSummary() {
    return MOCK;
  },
};

export { MOCK as MOCK_WHATSAPP };
