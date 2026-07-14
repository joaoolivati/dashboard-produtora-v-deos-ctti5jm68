import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getServicos, type ServicoRecord } from '@/services/servicos'
import { useRealtime } from '@/hooks/use-realtime'

export interface VideoRecord {
  id: string
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

const formatDate = (isoDate: string): string => {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

const parseDurationToHours = (duration: string): number => {
  if (!duration) return 0
  const parts = duration.split(':').map(Number)
  if (parts.length === 2) return parts[0] + parts[1] / 60
  if (parts.length === 3) return parts[0] + parts[1] / 60 + parts[2] / 3600
  return 0
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

const mapToVideoRecord = (s: ServicoRecord): VideoRecord => ({
  id: s.id,
  dataDoServico: formatDate(s.data_entrega),
  mesFaturamento: s.status || '',
  valor: s.valor || 0,
  identificacao: s.identificacao || '',
  especialista: s.cliente || '',
  editor: '',
  tipoDeVideo: s.categoria || '',
  horasEditadas: 0,
})

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
      const records = await getServicos()
      const mapped = records.map(mapToVideoRecord)
      setData(mapped)
      setLastUpdated(new Date())
    } catch (err: any) {
      setError(err.message || 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useRealtime('servicos', () => {
    fetchData()
  })

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
