import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCostControl } from '@/contexts/cost-control-context'
import { usePrivacy } from '@/contexts/privacy-context'
import { taxPercentageSchema } from '@/lib/cost-schemas'
import { Percent, Check } from 'lucide-react'
import { toast } from 'sonner'

export function TaxCard() {
  const { realizedRevenue, taxSettings, updateTaxPercentage } = useCostControl()
  const { formatCurrency } = usePrivacy()
  const [pct, setPct] = useState(String(taxSettings?.percentage || 0))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setPct(String(taxSettings?.percentage || 0))
  }, [taxSettings])

  const taxAmount = realizedRevenue * ((taxSettings?.percentage || 0) / 100)

  const handleSave = async () => {
    const val = parseFloat(pct) || 0
    const parsed = taxPercentageSchema.safeParse({ percentage: val })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message)
      return
    }
    await updateTaxPercentage(parsed.data.percentage)
    setEditing(false)
  }

  const selectText = { userSelect: 'text' as const, WebkitUserSelect: 'text' as const }

  return (
    <Card className="glass animate-fade-in-up">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Percent className="h-4 w-4 text-chart-3" strokeWidth={1.5} />
          Imposto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Faturamento realizado</p>
          <p className="text-lg font-mono font-semibold select-text" style={selectText}>
            {formatCurrency(realizedRevenue)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">% do Simples Nacional</p>
          {editing ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                className="h-8 w-28"
                step="0.1"
                min="0"
                max="100"
              />
              <Button size="icon" className="h-7 w-7" onClick={handleSave}>
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-lg font-mono font-semibold hover:text-primary transition-colors mt-1"
            >
              {(taxSettings?.percentage || 0).toLocaleString('pt-BR')}%
            </button>
          )}
        </div>
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">Imposto calculado</p>
          <p className="text-xl font-mono font-bold select-text" style={selectText}>
            {formatCurrency(taxAmount)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
