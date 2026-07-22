import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCostControl } from '@/contexts/cost-control-context'
import { usePrivacy } from '@/contexts/privacy-context'
import { Wallet, Percent, Users, TrendingUp } from 'lucide-react'
import { formatRate } from '@/lib/utils'

export function KpiCards() {
  const { monthlyCosts, realizedRevenue, loading, effectiveRate, taxAmount } = useCostControl()
  const { formatCurrency } = usePrivacy()

  const m = useMemo(() => {
    const totalCosts = monthlyCosts.reduce((s, c) => s + c.amount, 0)
    const payroll = monthlyCosts
      .filter((c) => c.category === 'salario')
      .reduce((s, c) => s + c.amount, 0)
    const payrollCount = monthlyCosts.filter((c) => c.category === 'salario').length
    const result = realizedRevenue - (totalCosts + taxAmount)
    const margin = realizedRevenue > 0 ? (result / realizedRevenue) * 100 : null
    return {
      totalWithTax: totalCosts + taxAmount,
      taxAmount,
      payroll,
      payrollCount,
      result,
      margin,
    }
  }, [monthlyCosts, taxAmount, realizedRevenue])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    )
  }

  const st = { userSelect: 'text' as const, WebkitUserSelect: 'text' as const }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
            Custo Total do Mês <Wallet className="h-4 w-4 text-primary" strokeWidth={1.5} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold font-mono select-text" style={st}>
            {formatCurrency(m.totalWithTax)}
          </p>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
            Imposto do Mês <Percent className="h-4 w-4 text-chart-3" strokeWidth={1.5} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold font-mono select-text" style={st}>
            {formatCurrency(m.taxAmount)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatRate(effectiveRate)}% efetiva
          </p>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
            Folha <Users className="h-4 w-4 text-chart-2" strokeWidth={1.5} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold font-mono select-text" style={st}>
            {formatCurrency(m.payroll)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {m.payrollCount} {m.payrollCount === 1 ? 'pessoa' : 'pessoas'}
          </p>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground flex items-center justify-between">
            Resultado do Mês <TrendingUp className="h-4 w-4 text-chart-4" strokeWidth={1.5} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-2xl font-bold font-mono select-text ${m.result >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
            style={st}
          >
            {formatCurrency(m.result)}
          </p>
          <p
            className={`text-xs mt-0.5 ${m.margin !== null && m.margin < 0 ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {m.margin !== null
              ? `${m.margin.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% de margem`
              : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
