import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCostControl } from '@/contexts/cost-control-context'
import { usePrivacy } from '@/contexts/privacy-context'
import { rbt12Schema } from '@/lib/cost-schemas'
import { Percent, Check, Pencil } from 'lucide-react'
import { toast } from 'sonner'

export function TaxCard() {
  const {
    realizedRevenue,
    taxSettings,
    updateTaxSettings,
    rbt12: autoRbt12,
    monthsWithHistory,
    effectiveRate,
    taxAmount,
  } = useCostControl()
  const { formatCurrency } = usePrivacy()
  const currentRbt12 = taxSettings?.rbt12 || autoRbt12
  const [rbt12Input, setRbt12Input] = useState(String(currentRbt12))
  const [rateInput, setRateInput] = useState(String(taxSettings?.nominalRate || 0))
  const [dedInput, setDedInput] = useState(String(taxSettings?.deduction || 0))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) {
      setRbt12Input(String(currentRbt12))
      setRateInput(String(taxSettings?.nominalRate || 0))
      setDedInput(String(taxSettings?.deduction || 0))
    }
  }, [currentRbt12, taxSettings, editing])

  const handleSave = async () => {
    const parsed = rbt12Schema.safeParse({
      rbt12: parseFloat(rbt12Input.replace(',', '.')) || 0,
      nominalRate: parseFloat(rateInput.replace(',', '.')) || 0,
      deduction: parseFloat(dedInput.replace(',', '.')) || 0,
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message)
      return
    }
    await updateTaxSettings(parsed.data)
    setEditing(false)
  }

  const st = { userSelect: 'text' as const, WebkitUserSelect: 'text' as const }
  const hasPartial = monthsWithHistory < 12

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
          <p className="text-lg font-mono font-semibold select-text" style={st}>
            {formatCurrency(realizedRevenue)}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">RBT12 (12 meses)</p>
            {hasPartial && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                RBT12 parcial: apenas {monthsWithHistory}{' '}
                {monthsWithHistory === 1 ? 'mês' : 'meses'} de histórico
              </span>
            )}
          </div>
          {editing ? (
            <Input
              type="number"
              value={rbt12Input}
              onChange={(e) => setRbt12Input(e.target.value)}
              className="h-8 mt-1 font-mono"
              step="0.01"
              min="0"
            />
          ) : (
            <p className="text-lg font-mono font-semibold select-text" style={st}>
              {formatCurrency(currentRbt12)}
            </p>
          )}
        </div>

        {editing ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Alíquota nominal %</p>
              <Input
                type="number"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="h-8 mt-1"
                step="0.01"
                min="0"
                max="100"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dedução R$</p>
              <Input
                type="number"
                value={dedInput}
                onChange={(e) => setDedInput(e.target.value)}
                className="h-8 mt-1 font-mono"
                step="0.01"
                min="0"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleSave}>
                <Check className="h-3.5 w-3.5 mr-1" /> Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Alíquota nominal</p>
              <p className="text-sm font-mono font-medium select-text" style={st}>
                {(taxSettings?.nominalRate || 0).toLocaleString('pt-BR')}%
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Dedução</p>
              <p className="text-sm font-mono font-medium select-text" style={st}>
                {formatCurrency(taxSettings?.deduction || 0)}
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">Alíquota efetiva</p>
              <p className="text-sm font-mono font-bold select-text" style={st}>
                {effectiveRate.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                %
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Imposto calculado</p>
              <p className="text-xl font-mono font-bold select-text" style={st}>
                {formatCurrency(taxAmount)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3 mr-1" /> Editar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
