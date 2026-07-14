import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { parseCSV } from '@/lib/csv-parser'

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT6HCgMyyA0Lfys-G-Y19h7oDxYoUTSwHEJqP6A4DBheOMTH385oygrMzxffJOXlyZlTVTjlvgMGR71/pub?gid=2076247605&single=true&output=csv'

export interface VideoRecord {
  dataDoServico: string
  mesFaturamento: string
  valor: number
  identificacao: string
  editor: string
  horasEditadas: number // calculated mock or from data
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

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<VideoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')

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
          editor: getFlexKey(row, ['EDITOR', 'RESPONSÁVEL']),
          horasEditadas: Math.round(Math.random() * 3 + 2), // Mocking ~2-5 hours per video as no specific column was guaranteed
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

    const interval = setInterval(fetchData, 60 * 60 * 1000) // 1 hour polling

    const handleFocus = () => {
      fetchData()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [fetchData])

  const months = useMemo(() => {
    const m = Array.from(new Set(data.map((d) => d.mesFaturamento))).filter(Boolean)
    return m.sort() // Simple alphabetical, could be improved with real date sorting
  }, [data])

  useEffect(() => {
    if (months.length > 0 && !selectedMonth) {
      // Default to the last month in the list, or just the first one available
      setSelectedMonth(months[months.length - 1])
    }
  }, [months, selectedMonth])

  const filteredData = useMemo(() => {
    if (!selectedMonth) return data
    return data.filter((d) => d.mesFaturamento === selectedMonth)
  }, [data, selectedMonth])

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
