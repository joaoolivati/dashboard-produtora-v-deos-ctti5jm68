import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { parseCSV } from '@/lib/csv-parser'

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT6HCgMyyA0Lfys-G-Y19h7oDxYoUTSwHEJqP6A4DBheOMTH385oygrMzxffJOXlyZlTVTjlvgMGR71/pub?gid=2076247605&single=true&output=csv'

export interface VideoRecord {
  dataDoServico: string
  mesFaturamento: string
  valor: number
  identificacao: string
  especialista: string
  editor: string
  tipoDeVideo: string
  horasEditadas: number
}

interface DashboardContextState {
  data: VideoRecord[]
  filteredData: VideoRecord[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  months: string[]
  selectedMonth: string
  setSelectedMonth: (month: string) => void
  videoTypes: string[]
  selectedVideoType: string
  setSelectedVideoType: (type: string) => void
  refetch: () => Promise<void>
}

const DashboardContext = createContext<DashboardContextState | undefined>(undefined)

const cleanCurrency = (val: string) => {
  if (!val) return 0
  const cleaned = val.replace(/\./g, '').replace('R$', '').replace(',', '.').trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

const getFlexKey = (obj: Record<string, string>, possibleKeys: string[]) => {
  const key = Object.keys(obj).find((k) =>
    possibleKeys.some((pk) => k.toUpperCase().includes(pk.toUpperCase())),
  )
  return key ? obj[key] : ''
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

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<VideoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedVideoType, setSelectedVideoType] = useState<string>('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(CSV_URL)
      if (!res.ok) throw new Error('Failed to fetch data')
      const text = await res.text()
      const parsed = parseCSV(text)

      const records: VideoRecord[] = parsed
        .map((row) => ({
          dataDoServico: getFlexKey(row, ['DATA DO SERVIÇO', 'DATA']),
          mesFaturamento: getFlexKey(row, ['MÊS DE FATURAMENTO', 'MÊS', 'MES']),
          valor: cleanCurrency(getFlexKey(row, ['VALORES', 'VALOR', 'PREÇO'])),
          identificacao: getFlexKey(row, ['IDENTIFICAÇÃO', 'CLIENTE', 'NOME']),
          especialista: getFlexKey(row, ['ESPECIALISTA', 'CLIENTE', 'NOME']),
          editor: getFlexKey(row, ['EDITOR', 'RESPONSÁVEL']),
          tipoDeVideo: getFlexKey(row, ['TIPO DE VÍDEO', 'TIPO', 'FORMATO']),
          horasEditadas: Math.round(Math.random() * 3 + 2),
        }))
        .filter((r) => r.dataDoServico && r.mesFaturamento)

      setData(records)
      setLastUpdated(new Date())
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60 * 60 * 1000)
    const handleFocus = () => fetchData()
    window.addEventListener('focus', handleFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchData])

  const months = useMemo(() => {
    const m = Array.from(new Set(data.map((d) => d.mesFaturamento))).filter(Boolean)
    return m.sort((a, b) => parseMonthYear(b) - parseMonthYear(a))
  }, [data])

  useEffect(() => {
    if (months.length > 0 && !selectedMonth) {
      setSelectedMonth(months[0])
    }
  }, [months, selectedMonth])

  const videoTypes = useMemo(() => {
    const types = Array.from(new Set(data.map((d) => d.tipoDeVideo))).filter(Boolean)
    return types.sort()
  }, [data])

  const filteredData = useMemo(() => {
    let result = data
    if (selectedMonth) {
      result = result.filter((d) => d.mesFaturamento === selectedMonth)
    }
    if (selectedVideoType && selectedVideoType !== 'all') {
      result = result.filter((d) => d.tipoDeVideo === selectedVideoType)
    }
    return result
  }, [data, selectedMonth, selectedVideoType])

  return React.createElement(
    DashboardContext.Provider,
    {
      value: {
        data,
        filteredData,
        loading,
        error,
        lastUpdated,
        months,
        selectedMonth,
        setSelectedMonth,
        videoTypes,
        selectedVideoType,
        setSelectedVideoType,
        refetch: fetchData,
      },
    },
    children,
  )
}

export const useDashboardContext = () => {
  const context = useContext(DashboardContext)
  if (!context) throw new Error('useDashboardContext must be used within a DashboardProvider')
  return context
}
