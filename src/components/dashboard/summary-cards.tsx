import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'
import { usePrivacy } from '@/contexts/privacy-context'
import { useDashboardContext } from '@/contexts/dashboard-context'
import { Video, DollarSign, Target, Clock } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function SummaryCards() {
  const { filteredData, loading } = useDashboardContext()
  const { formatCurrency } = usePrivacy()

  const metrics = useMemo(() => {
    const totalVideos = filteredData.length
    const totalRevenue = filteredData.reduce((sum, item) => sum + item.valor, 0)
    const avgTicket = totalVideos > 0 ? totalRevenue / totalVideos : 0
    const totalHours = filteredData.reduce((sum, item) => sum + item.horasEditadas, 0)

    return { totalVideos, totalRevenue, avgTicket, totalHours }
  }, [filteredData])

  if (loading && filteredData.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="premium-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
      <Card className="premium-card relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Faturamento Total
          </CardTitle>
          <DollarSign className="h-4 w-4 text-primary" strokeWidth={1.5} />
        </CardHeader>
        <CardContent>
          <div
            className="text-3xl font-bold font-mono tracking-tight text-foreground select-text"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
          >
            {formatCurrency(metrics.totalRevenue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">No mês selecionado</p>
        </CardContent>
      </Card>

      <Card className="premium-card relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-chart-2/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total de Vídeos
          </CardTitle>
          <Video className="h-4 w-4 text-chart-2" strokeWidth={1.5} />
        </CardHeader>
        <CardContent>
          <div
            className="text-3xl font-bold font-mono tracking-tight text-foreground select-text"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
          >
            {formatNumber(metrics.totalVideos)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Projetos finalizados</p>
        </CardContent>
      </Card>

      <Card className="premium-card relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-chart-3/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
          <Target className="h-4 w-4 text-chart-3" strokeWidth={1.5} />
        </CardHeader>
        <CardContent>
          <div
            className="text-3xl font-bold font-mono tracking-tight text-foreground select-text"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
          >
            {formatCurrency(metrics.avgTicket)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Por vídeo editado</p>
        </CardContent>
      </Card>

      <Card className="premium-card relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-chart-4/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total de Horas
          </CardTitle>
          <Clock className="h-4 w-4 text-chart-4" strokeWidth={1.5} />
        </CardHeader>
        <CardContent>
          <div
            className="text-3xl font-bold font-mono tracking-tight text-foreground select-text"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
          >
            {formatNumber(metrics.totalHours)}h
          </div>
          <p className="text-xs text-muted-foreground mt-1">Horas produtivas</p>
        </CardContent>
      </Card>
    </div>
  )
}
