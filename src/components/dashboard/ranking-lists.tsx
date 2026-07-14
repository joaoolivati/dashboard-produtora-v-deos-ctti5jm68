import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboardContext } from '@/contexts/dashboard-context'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Trophy, TrendingUp } from 'lucide-react'

export function RankingLists() {
  const { filteredData, loading } = useDashboardContext()

  const { clientRanking, editorRanking } = useMemo(() => {
    if (!filteredData.length) return { clientRanking: [], editorRanking: [] }

    const clientMap = new Map<string, number>()
    const editorMap = new Map<string, { rev: number; count: number }>()

    filteredData.forEach((item) => {
      // Clients
      const clientName = item.identificacao || 'Desconhecido'
      clientMap.set(clientName, (clientMap.get(clientName) || 0) + item.valor)

      // Editors
      const editorName = item.editor || 'Não Atribuído'
      const edStat = editorMap.get(editorName) || { rev: 0, count: 0 }
      edStat.rev += item.valor
      edStat.count += 1
      editorMap.set(editorName, edStat)
    })

    const clientRanking = Array.from(clientMap.entries())
      .map(([name, rev]) => ({ name, rev }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5)

    const editorRanking = Array.from(editorMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5)

    return { clientRanking, editorRanking }
  }, [filteredData])

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  if (loading && filteredData.length === 0) {
    return (
      <Card className="premium-card h-full">
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
      <Card className="premium-card flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg">Top Clientes</CardTitle>
          </div>
          <CardDescription>Os clientes que mais geraram receita no mês</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col">
            {clientRanking.length > 0 ? (
              clientRanking.map((client, index) => (
                <div key={index}>
                  <div className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                    <Avatar className="h-9 w-9 border border-border/50 bg-background shadow-sm">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium text-xs">
                        {getInitials(client.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-foreground">
                        {formatCurrency(client.rev)}
                      </p>
                    </div>
                  </div>
                  {index < clientRanking.length - 1 && (
                    <Separator className="mx-6 w-auto opacity-50" />
                  )}
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                Nenhum dado encontrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="premium-card flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-chart-1" />
            <CardTitle className="text-lg">Desempenho dos Editores</CardTitle>
          </div>
          <CardDescription>Performance por faturamento e volume</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col">
            {editorRanking.length > 0 ? (
              editorRanking.map((editor, index) => (
                <div key={index}>
                  <div className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                    <Avatar className="h-9 w-9 border border-border/50 bg-background shadow-sm">
                      <AvatarFallback className="bg-chart-2/10 text-chart-2 font-medium text-xs">
                        {getInitials(editor.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{editor.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {editor.count} {editor.count === 1 ? 'vídeo' : 'vídeos'} entregues
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-foreground">
                        {formatCurrency(editor.rev)}
                      </p>
                    </div>
                  </div>
                  {index < editorRanking.length - 1 && (
                    <Separator className="mx-6 w-auto opacity-50" />
                  )}
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                Nenhum dado encontrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
