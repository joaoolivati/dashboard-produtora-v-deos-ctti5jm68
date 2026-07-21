import type { VideoRecord } from '@/contexts/dashboard-context'

export interface PredictionPoint {
  day: number
  label: string
  actual: number | null
  projected: number | null
}

export interface PredictionResult {
  points: PredictionPoint[]
  projectedTotal: number
  currentTotal: number
  dailyAvg: number
  daysElapsed: number
}

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

const parseDay = (s: string): number => parseInt(s.split('/')[0]) || 0

const getDaysInMonth = (monthStr: string): number => {
  const parts = monthStr.toUpperCase().split('/')
  if (parts.length !== 2) return 30
  const m = MONTH_MAP[parts[0].trim()] || 7
  const y = parseInt(parts[1].trim())
  return new Date(y < 100 ? 2000 + y : y, m, 0).getDate()
}

const aggregateByDay = (records: VideoRecord[]): Record<number, number> => {
  const byDay: Record<number, number> = {}
  records.forEach((r) => {
    const d = parseDay(r.dataDoServico)
    if (d > 0) byDay[d] = (byDay[d] || 0) + r.valor
  })
  return byDay
}

const parseMonthYear = (str: string): number => {
  if (!str) return 0
  const parts = str.toUpperCase().split('/')
  if (parts.length !== 2) return 0
  const monthNum = MONTH_MAP[parts[0].trim()]
  if (!monthNum) return 0
  const yearNum = parseInt(parts[1].trim())
  const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum
  return fullYear * 100 + monthNum
}

const get6MonthWindow = (selectedMonth: string): { start: number; end: number } => {
  const selectedVal = parseMonthYear(selectedMonth)
  if (!selectedVal) return { start: 0, end: 0 }
  const selMonth = selectedVal % 100
  const selYear = Math.floor(selectedVal / 100)
  let endMonth = selMonth - 1
  let endYear = selYear
  if (endMonth === 0) {
    endMonth = 12
    endYear--
  }
  let startMonth = endMonth - 5
  let startYear = endYear
  while (startMonth <= 0) {
    startMonth += 12
    startYear--
  }
  return { start: startYear * 100 + startMonth, end: endYear * 100 + endMonth }
}

export function generatePrediction(
  currentData: VideoRecord[],
  allData: VideoRecord[],
  selectedMonth: string,
): PredictionPoint[] {
  return computePrediction(currentData, allData, selectedMonth).points
}

export function computePrediction(
  currentData: VideoRecord[],
  allData: VideoRecord[],
  selectedMonth: string,
): PredictionResult {
  if (!currentData.length) {
    return { points: [], projectedTotal: 0, currentTotal: 0, dailyAvg: 0, daysElapsed: 0 }
  }

  const currentByDay = aggregateByDay(currentData)
  const sortedDays = Object.keys(currentByDay)
    .map(Number)
    .sort((a, b) => a - b)
  if (!sortedDays.length) {
    return { points: [], projectedTotal: 0, currentTotal: 0, dailyAvg: 0, daysElapsed: 0 }
  }

  let cumulative = 0
  const actualCumul = new Map<number, number>()
  sortedDays.forEach((d) => {
    cumulative += currentByDay[d]
    actualCumul.set(d, cumulative)
  })
  const currentDay = sortedDays[sortedDays.length - 1]
  const currentTotal = cumulative

  const window = get6MonthWindow(selectedMonth)
  const histData = allData.filter((d) => {
    const val = parseMonthYear(d.mesFaturamento)
    return val >= window.start && val <= window.end
  })
  const histByMonth: Record<string, VideoRecord[]> = {}
  histData.forEach((r) => {
    const m = r.mesFaturamento
    ;(histByMonth[m] ||= []).push(r)
  })

  const dayPcts: Record<number, number[]> = {}
  const specialistRev: Record<string, number[]> = {}

  Object.values(histByMonth).forEach((records) => {
    const byDay = aggregateByDay(records)
    const total = Object.values(byDay).reduce((a, b) => a + b, 0)
    if (!total) return
    let cumul = 0
    Object.keys(byDay)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((d) => {
        cumul += byDay[d]
        ;(dayPcts[d] ||= []).push(cumul / total)
      })
    const specMonth: Record<string, number> = {}
    records.forEach((r) => {
      if (r.especialista) specMonth[r.especialista] = (specMonth[r.especialista] || 0) + r.valor
    })
    Object.entries(specMonth).forEach(([s, v]) => {
      ;(specialistRev[s] ||= []).push(v)
    })
  })

  const avgPct = new Map<number, number>()
  Object.entries(dayPcts).forEach(([d, pcts]) => {
    avgPct.set(Number(d), pcts.reduce((a, b) => a + b, 0) / pcts.length)
  })

  const pctDays = Array.from(avgPct.keys()).sort((a, b) => a - b)
  const getPct = (day: number): number => {
    if (avgPct.has(day)) return avgPct.get(day)!
    if (!pctDays.length) return day / 30
    if (day <= pctDays[0]) return avgPct.get(pctDays[0])! * (day / pctDays[0])
    if (day >= pctDays[pctDays.length - 1]) return avgPct.get(pctDays[pctDays.length - 1])!
    for (let i = 0; i < pctDays.length - 1; i++) {
      if (pctDays[i] <= day && pctDays[i + 1] >= day) {
        const [d0, d1] = [pctDays[i], pctDays[i + 1]]
        const [p0, p1] = [avgPct.get(d0)!, avgPct.get(d1)!]
        return p0 + (p1 - p0) * ((day - d0) / (d1 - d0 || 1))
      }
    }
    return 1
  }

  const pctNow = getPct(currentDay)
  let projectedTotal = pctNow > 0 ? currentTotal / pctNow : currentTotal * 1.5

  const currentSpecs = new Set(currentData.map((d) => d.especialista).filter(Boolean))
  let specAdj = 0
  Object.entries(specialistRev).forEach(([s, revs]) => {
    if (revs.length >= 2 && !currentSpecs.has(s)) {
      specAdj += revs.reduce((a, b) => a + b, 0) / revs.length
    }
  })
  projectedTotal = Math.max(projectedTotal + specAdj * 0.5, currentTotal)

  const daysInMonth = getDaysInMonth(selectedMonth)
  const points: PredictionPoint[] = sortedDays.map((d) => ({
    day: d,
    label: `${d}`,
    actual: actualCumul.get(d) ?? null,
    projected: null,
  }))
  if (points.length) points[points.length - 1].projected = currentTotal
  for (let d = currentDay + 1; d <= daysInMonth; d++) {
    points.push({ day: d, label: `${d}`, actual: null, projected: projectedTotal * getPct(d) })
  }

  const daysElapsed = sortedDays.length
  const dailyAvg = daysElapsed > 0 ? currentTotal / daysElapsed : 0

  return { points, projectedTotal, currentTotal, dailyAvg, daysElapsed }
}
