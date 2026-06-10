// Implementação Supabase — tabela report_schedules + edge function send-report.

import { supabase, invokeFunction } from '@/shared/lib/supabase';
import type { ReportsRepo } from './reportsRepo';
import type { ReportSchedule, ReportSchedulePayload } from './types';

function toRow(payload: ReportSchedulePayload) {
  return {
    nome:           payload.nome,
    destinatarios:  payload.destinatarios || [],
    whatsapp:       payload.whatsapp || [],
    canais:         payload.canais || ['email'],
    periodicidade:  payload.periodicidade,
    hora_envio:     payload.hora_envio,
    dia_semana:     payload.dia_semana ?? null,
    dia_mes:        payload.dia_mes ?? null,
    formato:        payload.formato,
    metricas:       payload.metricas,
    periodo_dados:  payload.periodo_dados,
    ativo:          payload.ativo ?? true,
  };
}

export const supabaseReportsRepo: ReportsRepo = {
  async list() {
    const { data, error } = await supabase
      .from('report_schedules')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data as unknown as ReportSchedule[];
  },

  async add(payload) {
    const { data, error } = await supabase
      .from('report_schedules')
      .insert(toRow(payload))
      .select()
      .single();
    return { data: (data as unknown as ReportSchedule) ?? null, error };
  },

  async remove(id) {
    const { error } = await supabase.from('report_schedules').delete().eq('id', id);
    return { error };
  },

  async toggleActive(id, current) {
    const next = !current;
    const { error } = await supabase
      .from('report_schedules')
      .update({ ativo: next })
      .eq('id', id);
    return { ativo: next, error };
  },

  async sendNow(id) {
    try {
      const { data, error } = await invokeFunction<{ message?: string }>('send-report', { schedule_id: id });
      if (error) return { ok: false, msg: error.message || 'Erro ao chamar a Edge Function.' };
      return { ok: true, msg: data?.message || 'E-mail enviado!' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao invocar a função.';
      return { ok: false, msg };
    }
  },
};
