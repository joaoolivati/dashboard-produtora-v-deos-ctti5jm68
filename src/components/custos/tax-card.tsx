import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCostControl } from '@/contexts/cost-control-context'
import { usePrivacy } from '@/contexts/privacy-context'
import { effectiveRateSchema } from '@/lib/cost-schemas'
import { formatRate } from '@/lib/utils'
import { formatISOMonthLabel } from '@/lib/month-utils'
import { Percent } from 'lucide-react'
import { toast } from 'sonner'

export function TaxCard() {
  const { realizedRevenue, taxSettings, updateTaxSettings, effectiveRate, inheritedRate } =
    useCostControl()
  const { formatCurrency } = usePrivacy()

  const currentRate = taxSettings?.percentage ?? effectiveRate
  const [rateInput, setRateInput] = useState(formatRate(currentRate))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setRateInput(formatRate(currentRate))
    }
  }, [currentRate, focused])

  const parsedRate = parseFloat(rateInput.replace(',', '.')) || 0
  const calculatedTax = realizedRevenue * (parsedRate / 100)

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    val = val.replace(/\./g, ',')
    val = val.replace(/[^\d,]/g, '')
    const commaIdx = val.indexOf(',')
    if (commaIdx !== -1) {
      const before = val.slice(0, commaIdx)
      const after = val
        .slice(commaIdx + 1)
        .replace(/,/g, '')
        .slice(0, 5)
      val = before + ',' + after
    }
    setRateInput(val)
  }

  const handleBlur = async () => {
    setFocused(false)
    const rate = parseFloat(rateInput.replace(',', '.')) || 0

    const parsed = effectiveRateSchema.safeParse({ percentage: rate })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message)
      setRateInput(formatRate(currentRate))
      return
    }

    if (rate !== currentRate) {
      await updateTaxSettings({ percentage: rate })
    } else {
      setRateInput(formatRate(currentRate))
    }
  }

  const st = { userSelect: 'text' as const, WebkitUserSelect: 'text' as const }

  return (
    <Card className="glass animate-fade-in-up">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Percent className="h-4 w-4 text-chart-3" strokeWidth={1.5} />
          Imposto
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">Faturamento realizado</p>
          <p className="text-lg font-mono font-semibold select-text" style={st}>
            {formatCurrency(realizedRevenue)}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Alíquota efetiva (%)</p>
          <div className="relative">
            <Input
              type="text"
              inputMode="decimal"
              value={rateInput}
              onChange={handleRateChange}
              onFocus={() => setFocused(true)}
              onBlur={handleBlur}
              className="pr-8 font-mono"
              placeholder="0,00"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              %
            </span>
          </div>
          {inheritedRate && !taxSettings && (
            <p className="text-[11px] text-muted-foreground mt-1 italic">
              Herdado de {formatISOMonthLabel(inheritedRate.sourceMonth)} — ajuste se mudou.
            </p>
          )}
        </div>

        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">Imposto calculado</p>
          <p className="text-xl font-mono font-bold select-text" style={st}>
            {formatCurrency(calculatedTax)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
