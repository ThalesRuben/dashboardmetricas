// Implementação mock — agendamentos persistidos em localStorage.

import type { ReportsRepo } from './reportsRepo';
import type { ReportSchedule, ReportSchedulePayload } from './types';

const STORAGE_KEY = 'ads-dash:schedules-fallback';

function load(): ReportSchedule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReportSchedule[]) : [];
  } catch { return []; }
}
function save(list: ReportSchedule[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function build(payload: ReportSchedulePayload): ReportSchedule {
  return {
    id: Date.now(),
    created_at: new Date().toISOString(),
    nome: payload.nome,
    destinatarios: payload.destinatarios || [],
    whatsapp: payload.whatsapp || [],
    canais: payload.canais || ['email'],
    periodicidade: payload.periodicidade,
    hora_envio: payload.hora_envio,
    dia_semana: payload.dia_semana ?? null,
    dia_mes: payload.dia_mes ?? null,
    formato: payload.formato,
    metricas: payload.metricas,
    periodo_dados: payload.periodo_dados,
    ativo: payload.ativo ?? true,
  };
}

export const mockReportsRepo: ReportsRepo = {
  async list() {
    return load();
  },

  async add(payload) {
    const row = build(payload);
    const next = [row, ...load()];
    save(next);
    return { data: row, error: null };
  },

  async remove(id) {
    save(load().filter(s => s.id !== id));
    return { error: null };
  },

  async toggleActive(id, current) {
    const next = !current;
    save(load().map(s => (s.id === id ? { ...s, ativo: next } : s)));
    return { ativo: next, error: null };
  },

  async sendNow() {
    return {
      ok: false,
      msg: 'Edge Function send-report não disponível em modo local. Configure o Supabase + Resend para envio real.',
    };
  },
};
