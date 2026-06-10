export function formatAlertTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay)     return `Hoje, ${hh}:${mm}`
  if (isYesterday) return `Ontem, ${hh}:${mm}`
  return d.toLocaleDateString('pt-BR') + `, ${hh}:${mm}`
}
