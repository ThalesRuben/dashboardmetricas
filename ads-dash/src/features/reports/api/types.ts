// Tipos públicos da feature `reports` — agendamentos de relatório por e-mail/WhatsApp.

export type ReportCanal = 'email' | 'whatsapp';
export type ReportPeriodicidade = 'diaria' | 'semanal' | 'mensal';
export type ReportFormato = 'pdf' | 'csv' | 'html';
export type ReportPeriodoDados = 'hoje' | 'ontem' | 'semana' | 'mes';

export interface ReportSchedule {
  id: number | string;
  nome: string;
  destinatarios: string[];
  whatsapp: string[];
  canais: ReportCanal[];
  periodicidade: ReportPeriodicidade;
  hora_envio: string;
  dia_semana: number | null;
  dia_mes: number | null;
  formato: ReportFormato;
  metricas: string[];
  periodo_dados: ReportPeriodoDados;
  ativo: boolean;
  created_at?: string;
}

export interface ReportSchedulePayload {
  nome: string;
  destinatarios?: string[];
  whatsapp?: string[];
  canais?: ReportCanal[];
  periodicidade: ReportPeriodicidade;
  hora_envio: string;
  dia_semana?: number | null;
  dia_mes?: number | null;
  formato: ReportFormato;
  metricas: string[];
  periodo_dados: ReportPeriodoDados;
  ativo?: boolean;
}

export interface SendNowResult {
  ok: boolean;
  msg: string;
}
