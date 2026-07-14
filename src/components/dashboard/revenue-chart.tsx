import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { useDashboardContext } from '@/contexts/dashboard-context'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'

export function RevenueChart() {
  const { filteredData, loading } = useDashboardContext()

  const chartData = useMemo(() => {
    if (!filteredData.length) return []

    // Aggregate by date
    const aggregated = filteredData.reduce(
      (acc, curr) => {
        const date = curr.dataDoServico
        if (!acc[date]) {
          acc[date] = 0
        }
        acc[date] += curr.valor
        return acc
      },
      {} as Record<string, number>,
    )

    // Sort by date (assuming DD/MM/YYYY format, simple split logic)
    const sortedDates = Object.keys(aggregated).sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number)
      const [db, mb, yb] = b.split('/').map(Number)
      const dateA = new Date(ya || 2024, ma ? ma - 1 : 0, da || 1).getTime()
      const dateB = new Date(yb || 2024, mb ? mb - 1 : 0, db || 1).getTime()
      return dateA - dateB
    })

    let cumulative = 0
    const result = sortedDates.map((date) => {
      cumulative += aggregated[date]
      return {
        date,
        revenue: aggregated[date],
        cumulative,
      }
    })

    // Calculate projection if we have dates
    if (result.length > 0 && result.length < 31) {
      const currentAvg = cumulative / result.length
      const projectedTotal = currentAvg * 30 // Rough 30-day projection
      result.push({
        date: 'Projeção Mês',
        revenue: 0,
        cumulative: projectedTotal,
      })
    }

    return result
  }, [filteredData])

  const chartConfig = {
    cumulative: {
      label: 'Acumulado',
      color: 'hsl(var(--chart-1))',
    },
    revenue: {
      label: 'Diário',
      color: 'hsl(var(--chart-2))',
    },
  }

  if (loading && filteredData.length === 0) {
    return (
      <Card className="premium-card flex flex-col h-[400px]">
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="flex-1 flex items-end">
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className="premium-card flex flex-col animate-fade-in-up"
      style={{ animationDelay: '100ms' }}
    >
      <CardHeader>
        <CardTitle className="font-bold tracking-tight">Evolução de Faturamento</CardTitle>
        <CardDescription>Crescimento diário acumulado no mês selecionado</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px]">
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillCumulative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-cumulative)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-cumulative)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                  }}
                  tickFormatter={(val) => (val.includes('/') ? val.split('/')[0] : 'Proj')}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                  }}
                  tickFormatter={(value) => `R$ ${value / 1000}k`}
                />
                <ChartTooltip
                  cursor={{
                    stroke: 'hsl(var(--muted-foreground))',
                    strokeWidth: 1,
                    strokeDasharray: '5 5',
                  }}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="var(--color-cumulative)"
                  strokeWidth={3}
                  fill="url(#fillCumulative)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-cumulative)' }}
                />
                {chartData.length > 1 && (
                  <ReferenceLine
                    y={chartData[chartData.length - 1].cumulative}
                    stroke="var(--color-cumulative)"
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Sem dados para o período.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
