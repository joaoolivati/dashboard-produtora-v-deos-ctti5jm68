import { isoMonthToDashboard } from '@/lib/month-utils'
import type { VideoRecord } from '@/contexts/dashboard-context'

export function getTrailing12MonthSet(isoMonth: string): Set<string> {
  if (!isoMonth) return new Set()
  const [year, month] = isoMonth.split('-').map(Number)
  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(year, month - 1 - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    months.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return new Set(months.map(isoMonthToDashboard))
}

export function calculateRbt12(data: VideoRecord[], isoMonth: string): number {
  const monthSet = getTrailing12MonthSet(isoMonth)
  return data.filter((d) => monthSet.has(d.mesFaturamento)).reduce((s, d) => s + d.valor, 0)
}

export function countMonthsWithHistory(data: VideoRecord[], isoMonth: string): number {
  const monthSet = getTrailing12MonthSet(isoMonth)
  const unique = new Set(
    data.filter((d) => monthSet.has(d.mesFaturamento)).map((d) => d.mesFaturamento),
  )
  return unique.size
}
