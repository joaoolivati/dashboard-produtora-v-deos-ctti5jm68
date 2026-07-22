import { useCostControl } from '@/contexts/cost-control-context'
import { usePrivacy } from '@/contexts/privacy-context'
import { formatISOMonthLabel } from '@/lib/month-utils'
import { TrendingUp, BarChart3 } from 'lucide-react'

export function RevenueBand() {
  const { realizedRevenue, projectedRevenue, isoMonth } = useCostControl()
  const { formatCurrency } = usePrivacy()

  return (
    <div className="glass rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in-up">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <BarChart3 className="h-6 w-6 text-primary" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            Faturamento realizado · {formatISOMonthLabel(isoMonth)}
          </p>
          <p
            className="text-2xl font-bold font-mono select-text"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
          >
            {formatCurrency(realizedRevenue)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 pl-4 sm:pl-0 sm:border-l sm:border-border/50">
        <TrendingUp className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        <div>
          <p className="text-sm text-muted-foreground">Projeção de fechamento</p>
          <p
            className="text-lg font-semibold font-mono select-text"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
          >
            {formatCurrency(projectedRevenue)}
          </p>
        </div>
      </div>
    </div>
  )
}
