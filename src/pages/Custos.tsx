import { CostControlProvider } from '@/contexts/cost-control-context'
import { RevenueBand } from '@/components/custos/revenue-band'
import { KpiCards } from '@/components/custos/kpi-cards'
import { CostSection } from '@/components/custos/cost-section'
import { TaxCard } from '@/components/custos/tax-card'
import { CompositionCard } from '@/components/custos/composition-card'

export default function Custos() {
  return (
    <CostControlProvider>
      <div className="flex flex-col gap-6 pb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Controle de Custos</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie custos recorrentes, variáveis e impostos do mês selecionado.
          </p>
        </div>
        <RevenueBand />
        <KpiCards />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <CostSection category="fixo" title="Custos Fixos" allowRecurring />
            <CostSection category="salario" title="Salários" allowRecurring />
            <CostSection category="ferramenta" title="Ferramentas" allowRecurring />
            <CostSection
              category="variavel"
              title="Custos Variáveis"
              allowRecurring={false}
              caption="Lançamentos avulsos do mês — não repetem."
            />
          </div>
          <div className="flex flex-col gap-4">
            <TaxCard />
            <CompositionCard />
          </div>
        </div>
      </div>
    </CostControlProvider>
  )
}
