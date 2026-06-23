// Mapa de identidade visual por rota — usado pelo PageHeader.
// Cada seção tem cor + número estável (parte do design "NN //").

export interface SectionInfo {
  color: string
  number: string
  label: string
}

export type SectionKey =
  | 'dashboard' | 'integrations' | 'reports' | 'instagram'
  | 'tiktok' | 'youtube' | 'whatsapp' | 'competitors'
  | 'ambassadors' | 'seo' | 'ia' | 'alerts' | 'metas' | 'settings' | 'bible'

export const SECTION_COLORS: Record<SectionKey, SectionInfo> = {
  dashboard:    { color: 'var(--section-dashboard)',    number: '01', label: 'DASHBOARD' },
  integrations: { color: 'var(--section-integrations)', number: '02', label: 'INTEGRAÇÕES' },
  reports:      { color: 'var(--section-reports)',      number: '03', label: 'RELATÓRIOS' },
  instagram:    { color: 'var(--section-instagram)',    number: '04', label: 'INSTAGRAM' },
  tiktok:       { color: 'var(--section-tiktok)',       number: '05', label: 'TIKTOK' },
  youtube:      { color: 'var(--section-youtube)',      number: '06', label: 'YOUTUBE' },
  whatsapp:     { color: 'var(--section-whatsapp)',     number: '07', label: 'WHATSAPP' },
  competitors:  { color: 'var(--section-competitors)',  number: '08', label: 'CONCORRENTES' },
  ambassadors:  { color: 'var(--section-ambassadors)',  number: '09', label: 'EMBAIXADORES' },
  seo:          { color: 'var(--section-seo)',          number: '10', label: 'SEO' },
  ia:           { color: 'var(--section-ia)',           number: '11', label: 'CENTRAL DE IA' },
  alerts:       { color: 'var(--section-alerts)',       number: '12', label: 'METAS E ALERTAS' },
  metas:        { color: 'var(--section-metas)',        number: '15', label: 'METAS' },
  settings:     { color: 'var(--section-settings)',     number: '13', label: 'CONFIGURAÇÕES' },
  bible:        { color: 'var(--accent-amber)',         number: '14', label: 'BÍBLIA DO MARKETING' },
}

export function sectionInfo(key: string | undefined): SectionInfo {
  return (key && SECTION_COLORS[key as SectionKey]) ?? { color: 'var(--text-subtle)', number: '00', label: 'SEÇÃO' }
}
