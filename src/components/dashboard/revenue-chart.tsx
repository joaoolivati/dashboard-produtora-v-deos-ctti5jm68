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
import { generatePrediction } from '@/lib/prediction'
import { formatCurrency } from '@/lib/utils'

const chartConfig = {
  actual: { label: 'Realizado', color: 'hsl(var(--chart-2))' },
  projected: { label: 'Projeção', color: 'hsl(var(--chart-5))' },
}

export function RevenueChart() {
  const { filteredData, data, loading, selectedMonth } = useDashboardContext()

  const chartData = useMemo(
    () => generatePrediction(filteredData, data, selectedMonth),
    [filteredData, data, selectedMonth],
  )

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
        <CardDescription>Receita acumulada realizada e projeção comportamental</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px]">
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-actual)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-actual)" stopOpacity={0} />
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
                  tickFormatter={(v) => `R$ ${v / 1000}k`}
                />
                <ChartTooltip
                  cursor={{
                    stroke: 'hsl(var(--muted-foreground))',
                    strokeWidth: 1,
                    strokeDasharray: '5 5',
                  }}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(_, payload) => `Dia ${payload?.[0]?.payload?.label ?? ''}`}
                      formatter={(value: number, name: string, item: any) => (
                        <div key={name} className="flex w-full items-center gap-2 text-sm">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-muted-foreground">
                            {name === 'actual' ? 'Realizado' : 'Projeção'}
                          </span>
                          <span className="ml-auto font-mono font-semibold">
                            {formatCurrency(Number(value) || 0)}
                          </span>
                        </div>
                      )}
                    />
                  }
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
