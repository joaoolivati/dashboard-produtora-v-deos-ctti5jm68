import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCostControl } from '@/contexts/cost-control-context'
import { usePrivacy } from '@/contexts/privacy-context'

export function CompositionCard() {
  const { monthlyCosts, taxSettings, realizedRevenue } = useCostControl()
  const { formatCurrency } = usePrivacy()

  const composition = useMemo(() => {
    const byCat = (cat: string) =>
      monthlyCosts.filter((m) => m.category === cat).reduce((s, m) => s + m.amount, 0)
    const imposto = realizedRevenue * ((taxSettings?.percentage || 0) / 100)
    const rows = [
      { label: 'Custos Fixos', value: byCat('fixo'), color: 'bg-primary' },
      { label: 'Custos Variáveis', value: byCat('variavel'), color: 'bg-chart-2' },
      { label: 'Folha', value: byCat('salario'), color: 'bg-chart-3' },
      { label: 'Ferramentas', value: byCat('ferramenta'), color: 'bg-chart-4' },
      { label: 'Imposto', value: imposto, color: 'bg-chart-5' },
    ]
    const total = rows.reduce((s, r) => s + r.value, 0)
    return rows.map((r) => ({ ...r, pct: total > 0 ? (r.value / total) * 100 : 0 }))
  }, [monthlyCosts, taxSettings, realizedRevenue])

  const selectText = { userSelect: 'text' as const, WebkitUserSelect: 'text' as const }

  return (
    <Card className="glass animate-fade-in-up">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Composição de Custos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {composition.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono font-medium select-text" style={selectText}>
                {formatCurrency(item.value)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-all duration-500`}
                style={{ width: `${item.pct}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
