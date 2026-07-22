const MONTH_MAP: Record<string, number> = {
  JANEIRO: 1,
  FEVEREIRO: 2,
  MARÇO: 3,
  MARCO: 3,
  ABRIL: 4,
  MAIO: 5,
  JUNHO: 6,
  JULHO: 7,
  AGOSTO: 8,
  SETEMBRO: 9,
  OUTUBRO: 10,
  NOVEMBRO: 11,
  DEZEMBRO: 12,
}

const REVERSE_MONTH: Record<number, string> = {
  1: 'JANEIRO',
  2: 'FEVEREIRO',
  3: 'MARÇO',
  4: 'ABRIL',
  5: 'MAIO',
  6: 'JUNHO',
  7: 'JULHO',
  8: 'AGOSTO',
  9: 'SETEMBRO',
  10: 'OUTUBRO',
  11: 'NOVEMBRO',
  12: 'DEZEMBRO',
}

export function dashboardMonthToISO(month: string): string {
  if (!month) return ''
  const parts = month.toUpperCase().split('/')
  if (parts.length !== 2) return ''
  const m = MONTH_MAP[parts[0].trim()]
  if (!m) return ''
  const y = parseInt(parts[1].trim())
  const fullYear = y < 100 ? 2000 + y : y
  return `${fullYear}-${String(m).padStart(2, '0')}`
}

export function isoMonthToDashboard(iso: string): string {
  if (!iso) return ''
  const [y, m] = iso.split('-')
  const monthNum = parseInt(m)
  const monthName = REVERSE_MONTH[monthNum]
  if (!monthName) return ''
  const shortYear = parseInt(y) % 100
  return `${monthName}/${String(shortYear).padStart(2, '0')}`
}

export function formatISOMonthLabel(iso: string): string {
  if (!iso) return ''
  const [y, m] = iso.split('-')
  const monthNum = parseInt(m)
  const monthName = REVERSE_MONTH[monthNum]
  if (!monthName) return iso
  return `${monthName}/${y}`
}
