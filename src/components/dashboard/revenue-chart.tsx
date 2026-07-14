import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts'
import { useDashboardContext } from '@/contexts/dashboard-context'
import { Skeleton } from '@/components/ui/skeleton'

interface ChartPoint {
  day: number
  label: string
  actual: number | null
  projected: number | null
}

export function RevenueChart() {
  const { filteredData, loading } = useDashboardContext()

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!filteredData.length) return []

    const aggregated: Record<string, number> = {}
    filteredData.forEach((item) => {
      const date = item.dataDoServico
      aggregated[date] = (aggregated[date] || 0) + item.valor
    })

    const sortedDates = Object.keys(aggregated).sort((a, b) => {
      const [da, ma, ya] = a.split('/').map(Number)
      const [db, mb, yb] = b.split('/').map(Number)
      const dateA = new Date(ya || 2024, ma ? ma - 1 : 0, da || 1).getTime()
      const dateB = new Date(yb || 2024, mb ? mb - 1 : 0, db || 1).getTime()
      return dateA - dateB
    })

    let cumulative = 0
    const points: ChartPoint[] = sortedDates.map((date) => {
      cumulative += aggregated[date]
      const day = parseInt(date.split('/')[0]) || 1
      return { day, label: String(day), actual: cumulative, projected: null }
    })

    if (points.length === 0) return []

    const dailyAvg = cumulative / points.length
    const lastDay = points[points.length - 1].day
    points[points.length - 1].projected = cumulative

    let projectedCumulative = cumulative
    for (let day = lastDay + 1; day <= 30; day++) {
      projectedCumulative += dailyAvg
      points.push({
        day,
        label: String(day),
        actual: null,
        projected: projectedCumulative,
      })
    }

    return points
  }, [filteredData])

  const chartConfig = {
    actual: { label: 'Realizado', color: 'hsl(var(--primary))' },
    projected: { label: 'Projeção', color: 'hsl(var(--muted-foreground))' },
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
        <CardDescription>Receita acumulada realizada e projeção de fechamento</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px]">
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-actual)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                  }}
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
                  dataKey="actual"
                  stroke="var(--color-actual)"
                  strokeWidth={3}
                  fill="url(#fillActual)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--color-actual)' }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="var(--color-projected)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-projected)' }}
                  connectNulls={false}
                />
              </ComposedChart>
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
