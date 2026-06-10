// Tipos públicos da feature `alerts`.

export type AlertTipo = 'danger' | 'warning' | 'success' | 'info';

export interface Alert {
  id: number | string;
  tipo: AlertTipo;
  mensagem: string;
  created_at: string;
}
