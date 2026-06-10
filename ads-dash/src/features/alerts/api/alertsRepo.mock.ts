// Implementação mock — alertas de demonstração com timestamps relativos.

import type { AlertsRepo } from './alertsRepo';
import type { Alert } from './types';

function hoursAgo(h: number): string {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
}

const FALLBACK: Alert[] = [
  { id: 1, tipo: 'danger',  mensagem: 'ROAS caiu para 2.9x na campanha "Salão BH — Display"', created_at: hoursAgo(2) },
  { id: 2, tipo: 'warning', mensagem: 'Orçamento 85% consumido — "Salão — Promoção Verão"',   created_at: hoursAgo(4) },
  { id: 3, tipo: 'success', mensagem: 'Meta de mensagens atingida: 148/100 hoje',              created_at: hoursAgo(5) },
  { id: 4, tipo: 'warning', mensagem: 'CTR Meta caiu abaixo de 2.5% entre 08h–09h',           created_at: hoursAgo(8) },
  { id: 5, tipo: 'success', mensagem: 'Vendas aprovadas atingiram meta diária: 37/25',         created_at: hoursAgo(6) },
];

export const mockAlertsRepo: AlertsRepo = {
  async list(limit = 20) {
    return FALLBACK.slice(0, limit);
  },
};

export { FALLBACK as MOCK_ALERTS };
