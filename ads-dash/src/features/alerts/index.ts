// API pública da feature `alerts`.
export { useAlerts } from './hooks/useAlerts';
export { formatAlertTime } from './lib/format';
export { alertsRepo } from './api/alertsRepo';
export type { Alert, AlertTipo } from './api/types';
