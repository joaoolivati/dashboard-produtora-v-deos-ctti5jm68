import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { TrendingUp } from 'lucide-react'
import { useDashboardContext } from '@/contexts/dashboard-context'
import { computePrediction } from '@/lib/prediction'
import { usePrivacy } from '@/contexts/privacy-context'

export function ProjectionCard() {
  const { filteredData, data, loading, selectedMonth } = useDashboardContext()
  const { formatCurrency } = usePrivacy()

  const projection = useMemo(() => {
    if (!filteredData.length) return { total: 0, dailyAvg: 0, projected: 0, daysElapsed: 0 }
    const result = computePrediction(filteredData, data, selectedMonth)
    return {
      total: result.currentTotal,
      dailyAvg: result.dailyAvg,
      projected: result.projectedTotal,
      daysElapsed: result.daysElapsed,
    }
  }, [filteredData, data, selectedMonth])

  if (loading && filteredData.length === 0) {
    return (
      <Card className="premium-card">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className="premium-card relative overflow-hidden group animate-fade-in-up"
      style={{ animationDelay: '150ms' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardContent className="p-6 relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">Projeção de Fechamento</p>
          <TrendingUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
          {formatCurrency(projection.projected)}
        </div>
        <p className="text-xs text-muted-foreground mt-1">Estimativa comportamental para o mês</p>
        <Separator className="my-4" />
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Média diária</p>
            <p className="text-sm font-semibold font-mono tracking-tight text-foreground">
              {formatCurrency(projection.dailyAvg)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Realizado até agora</p>
            <p className="text-sm font-semibold font-mono tracking-tight text-foreground">
              {formatCurrency(projection.total)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
