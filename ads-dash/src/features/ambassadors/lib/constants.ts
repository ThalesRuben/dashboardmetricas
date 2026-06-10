import type { AmbassadorTypeKey, AmbassadorStatusKey } from '../api/types'

export interface AmbassadorTypeOption {
  key: AmbassadorTypeKey
  label: string
}

export interface AmbassadorStatusOption {
  key: AmbassadorStatusKey
  label: string
  tone: 'success' | 'warning' | 'muted'
}

// Tipos de parceiro da marca
export const AMBASSADOR_TYPES: AmbassadorTypeOption[] = [
  { key: 'embaixador',    label: 'Embaixador' },
  { key: 'influenciador', label: 'Influenciador' },
  { key: 'micro',         label: 'Microinfluenciador' },
  { key: 'cliente-vip',   label: 'Cliente VIP' },
]

export const AMBASSADOR_STATUS: AmbassadorStatusOption[] = [
  { key: 'ativo',      label: 'Ativo',      tone: 'success' },
  { key: 'negociando', label: 'Negociando', tone: 'warning' },
  { key: 'pausado',    label: 'Pausado',    tone: 'muted'   },
]
