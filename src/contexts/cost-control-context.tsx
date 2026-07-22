import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useDashboardContext } from '@/contexts/dashboard-context'
import {
  getRecurringCosts,
  createRecurringCost,
  updateRecurringCost,
  type RecurringCost,
} from '@/services/recurring-costs'
import {
  getMonthlyCosts,
  createMonthlyCost,
  updateMonthlyCost,
  deleteMonthlyCost,
  type MonthlyCost,
} from '@/services/monthly-costs'
import { getTaxSettings, upsertTaxSettings, type TaxSettings } from '@/services/tax-settings'
import { dashboardMonthToISO } from '@/lib/month-utils'
import { computePrediction } from '@/lib/prediction'
import { calculateRbt12, countMonthsWithHistory } from '@/lib/rbt12'
import { toast } from 'sonner'
import { useRealtime } from '@/hooks/use-realtime'

interface CostControlState {
  isoMonth: string
  recurringCosts: RecurringCost[]
  monthlyCosts: MonthlyCost[]
  taxSettings: TaxSettings | null
  realizedRevenue: number
  projectedRevenue: number
  rbt12: number
  monthsWithHistory: number
  effectiveRate: number
  taxAmount: number
  loading: boolean
  addCost: (p: {
    name: string
    amount: number
    category: string
    recurring: boolean
  }) => Promise<void>
  updateCost: (id: string, p: { name: string; amount: number; recurring: boolean }) => Promise<void>
  deleteCost: (id: string, removeFromFuture: boolean) => Promise<void>
  updateTaxSettings: (p: {
    rbt12?: number
    nominalRate?: number
    deduction?: number
    percentage?: number
  }) => Promise<void>
}

const Ctx = createContext<CostControlState | undefined>(undefined)

export const CostControlProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { filteredData, data, selectedMonth } = useDashboardContext()
  const isoMonth = useMemo(() => dashboardMonthToISO(selectedMonth), [selectedMonth])

  const [recurringCosts, setRecurringCosts] = useState<RecurringCost[]>([])
  const [monthlyCosts, setMonthlyCosts] = useState<MonthlyCost[]>([])
  const [taxSettings, setTaxSettings] = useState<TaxSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const realizedRevenue = useMemo(
    () => filteredData.reduce((s, r) => s + r.valor, 0),
    [filteredData],
  )
  const projectedRevenue = useMemo(() => {
    if (!filteredData.length) return 0
    return computePrediction(filteredData, data, selectedMonth).projectedTotal
  }, [filteredData, data, selectedMonth])

  const rbt12 = useMemo(() => calculateRbt12(data, isoMonth), [data, isoMonth])
  const monthsWithHistory = useMemo(() => countMonthsWithHistory(data, isoMonth), [data, isoMonth])

  const effectiveRate = useMemo(() => {
    const rbt = taxSettings?.rbt12 || rbt12
    const rate = taxSettings?.nominalRate || 0
    const ded = taxSettings?.deduction || 0
    if (rbt > 0 && rate > 0) {
      return (((rbt * rate) / 100 - ded) / rbt) * 100
    }
    return taxSettings?.percentage || 0
  }, [taxSettings, rbt12])

  const taxAmount = useMemo(
    () => realizedRevenue * (effectiveRate / 100),
    [realizedRevenue, effectiveRate],
  )

  const fetchData = useCallback(async () => {
    if (!isoMonth) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [recurring, monthly, tax] = await Promise.all([
        getRecurringCosts(),
        getMonthlyCosts(isoMonth),
        getTaxSettings(isoMonth),
      ])
      if (monthly.length === 0 && recurring.some((r) => r.active)) {
        const created = await Promise.all(
          recurring
            .filter((r) => r.active)
            .map((r) =>
              createMonthlyCost({
                month: isoMonth,
                name: r.name,
                category: r.category,
                amount: r.amount,
                sourceId: r.id,
              }),
            ),
        )
        setMonthlyCosts(created)
      } else {
        setMonthlyCosts(monthly)
      }
      setRecurringCosts(recurring)
      setTaxSettings(tax)
    } catch {
      toast.error('Erro ao carregar dados de custos.')
    } finally {
      setLoading(false)
    }
  }, [isoMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData])
  useRealtime('monthly_costs', () => {
    fetchData()
  })
  useRealtime('recurring_costs', () => {
    fetchData()
  })
  useRealtime('tax_settings', () => {
    fetchData()
  })

  const addCost = useCallback(
    async (p: { name: string; amount: number; category: string; recurring: boolean }) => {
      try {
        const mc = await createMonthlyCost({
          month: isoMonth,
          name: p.name,
          amount: p.amount,
          category: p.category,
          sourceId: '',
        })
        if (p.recurring && p.category !== 'variavel') {
          const rc = await createRecurringCost({
            name: p.name,
            category: p.category,
            amount: p.amount,
            active: true,
          })
          await updateMonthlyCost(mc.id, { sourceId: rc.id })
        }
        await fetchData()
        toast.success('Item adicionado com sucesso.')
      } catch {
        toast.error('Erro ao adicionar item.')
      }
    },
    [isoMonth, fetchData],
  )

  const updateCost = useCallback(
    async (id: string, p: { name: string; amount: number; recurring: boolean }) => {
      try {
        const item = monthlyCosts.find((m) => m.id === id)
        if (!item) return
        await updateMonthlyCost(id, { name: p.name, amount: p.amount })
        if (p.recurring && item.category !== 'variavel') {
          if (item.sourceId) {
            await updateRecurringCost(item.sourceId, { name: p.name, amount: p.amount })
          } else {
            const rc = await createRecurringCost({
              name: p.name,
              category: item.category,
              amount: p.amount,
              active: true,
            })
            await updateMonthlyCost(id, { sourceId: rc.id })
          }
        }
        await fetchData()
        toast.success('Item atualizado com sucesso.')
      } catch {
        toast.error('Erro ao atualizar item.')
      }
    },
    [monthlyCosts, fetchData],
  )

  const deleteCost = useCallback(
    async (id: string, removeFromFuture: boolean) => {
      try {
        const item = monthlyCosts.find((m) => m.id === id)
        if (!item) return
        await deleteMonthlyCost(id)
        if (removeFromFuture && item.sourceId) {
          await updateRecurringCost(item.sourceId, { active: false })
        }
        await fetchData()
        toast.success('Item removido com sucesso.')
      } catch {
        toast.error('Erro ao remover item.')
      }
    },
    [monthlyCosts, fetchData],
  )

  const updateTaxSettings = useCallback(
    async (p: {
      rbt12?: number
      nominalRate?: number
      deduction?: number
      percentage?: number
    }) => {
      try {
        const updated = await upsertTaxSettings(isoMonth, p)
        setTaxSettings(updated)
        toast.success('Configurações de imposto atualizadas.')
      } catch {
        toast.error('Erro ao atualizar configurações de imposto.')
      }
    },
    [isoMonth],
  )

  return React.createElement(
    Ctx.Provider,
    {
      value: {
        isoMonth,
        recurringCosts,
        monthlyCosts,
        taxSettings,
        realizedRevenue,
        projectedRevenue,
        rbt12,
        monthsWithHistory,
        effectiveRate,
        taxAmount,
        loading,
        addCost,
        updateCost,
        deleteCost,
        updateTaxSettings,
      },
    },
    children,
  )
}

export const useCostControl = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCostControl must be used within a CostControlProvider')
  return ctx
}
