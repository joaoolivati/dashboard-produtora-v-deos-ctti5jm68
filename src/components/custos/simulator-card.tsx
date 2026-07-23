import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { useCostControl } from '@/contexts/cost-control-context'
import { usePrivacy } from '@/contexts/privacy-context'
import { formatBRLInput, parseBRLInput, handleBRLInputChange } from '@/lib/brl-input'
import { formatRate } from '@/lib/utils'
import { Calculator, RotateCcw, TrendingUp, TrendingDown, Scale } from 'lucide-react'

export function SimulatorCard() {
  const { monthlyCosts, realizedRevenue, effectiveRate, loading } = useCostControl()
  const { formatCurrency } = usePrivacy()

  const realTotalCosts = useMemo(
    () => monthlyCosts.reduce((s, c) => s + c.amount, 0),
    [monthlyCosts],
  )

  const [simRevenue, setSimRevenue] = useState(realizedRevenue)
  const [simCostStr, setSimCostStr] = useState(formatBRLInput(realTotalCosts))
  const prevLoadingRef = useRef(true)

  useEffect(() => {
    if (prevLoadingRef.current && !loading) {
      setSimRevenue(realizedRevenue)
      setSimCostStr(formatBRLInput(realTotalCosts))
    }
    prevLoadingRef.current = loading
  }, [loading, realizedRevenue, realTotalCosts])

  const simCost = parseBRLInput(simCostStr)

  const calc = useMemo(() => {
    const simTax = simRevenue * (effectiveRate / 100)
    const simResult = simRevenue - simCost - simTax
    const simMargin = simRevenue > 0 ? (simResult / simRevenue) * 100 : null
    const rateFactor = 1 - effectiveRate / 100
    const breakEven = rateFactor > 0 ? simCost / rateFactor : Infinity
    return {
      simTax,
      simResult,
      simMargin,
      breakEven,
      aboveBreakEven: simRevenue >= breakEven,
    }
  }, [simRevenue, simCost, effectiveRate])

  const handleResetAll = () => {
    setSimRevenue(realizedRevenue)
    setSimCostStr(formatBRLInput(realTotalCosts))
  }

  const handleResetCost = () => {
    setSimCostStr(formatBRLInput(realTotalCosts))
  }

  const st = { userSelect: 'text' as const, WebkitUserSelect: 'text' as const }

  return (
    <Card className="glass animate-fade-in-up">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" strokeWidth={1.5} />
          Simulador de Faturamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Faturamento simulado</span>
            <span className="text-lg font-mono font-bold select-text" style={st}>
              {formatCurrency(simRevenue)}
            </span>
          </div>
          <Slider
            value={[simRevenue]}
            onValueChange={(v) => setSimRevenue(v[0])}
            min={0}
            max={100000}
            step={100}
          />
          {calc.breakEven > 0 && calc.breakEven <= 100000 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Scale className="h-3 w-3" />
              Equilíbrio: <span className="font-mono">{formatCurrency(calc.breakEven)}</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Custo simulado</span>
            <button onClick={handleResetCost} className="text-[11px] text-primary hover:underline">
              custo real
            </button>
          </div>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              R$
            </span>
            <Input
              value={simCostStr}
              onChange={(e) => setSimCostStr(handleBRLInputChange(e.target.value))}
              className="pl-8 font-mono"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Alíquota efetiva (travada)</span>
          <span className="font-mono font-medium">{formatRate(effectiveRate)}%</span>
        </div>

        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Imposto simulado</span>
            <span className="font-mono font-medium select-text" style={st}>
              {formatCurrency(calc.simTax)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Resultado simulado</span>
            <span
              className={`font-mono font-bold select-text ${calc.simResult >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
              style={st}
            >
              {formatCurrency(calc.simResult)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Margem simulada</span>
            <span
              className={`font-mono font-medium select-text ${
                calc.simMargin === null
                  ? 'text-muted-foreground'
                  : calc.simMargin >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-destructive'
              }`}
              style={st}
            >
              {calc.simMargin !== null
                ? `${calc.simMargin.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                : '—'}
            </span>
          </div>
        </div>

        <div
          className={`flex items-center gap-1.5 text-sm font-medium ${
            calc.aboveBreakEven ? 'text-green-600 dark:text-green-400' : 'text-destructive'
          }`}
        >
          {calc.aboveBreakEven ? (
            <>
              <TrendingUp className="h-4 w-4" />
              Acima do equilíbrio — no lucro
            </>
          ) : (
            <>
              <TrendingDown className="h-4 w-4" />
              Abaixo do equilíbrio — no prejuízo
            </>
          )}
        </div>

        <Button variant="outline" size="sm" className="w-full" onClick={handleResetAll}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          Voltar ao real
        </Button>
      </CardContent>
    </Card>
  )
}
