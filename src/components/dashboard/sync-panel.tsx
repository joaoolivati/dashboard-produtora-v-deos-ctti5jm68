import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Clock, History, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { triggerManualSync } from '@/services/sync'
import { getSyncHistory, type SyncHistoryRecord } from '@/services/sync-history'
import { useRealtime } from '@/hooks/use-realtime'

export function SyncPanel() {
  const [syncing, setSyncing] = useState(false)
  const [history, setHistory] = useState<SyncHistoryRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadHistory = useCallback(async () => {
    try {
      const records = await getSyncHistory(15)
      setHistory(records)
    } catch {
      // silent fail — collection may not exist yet
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useRealtime('sync_history', () => {
    loadHistory()
  })

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await triggerManualSync()
      if (result.status === 'error') {
        toast.error(result.error || result.message || 'Erro na sincronização.')
      } else if (result.rowsRead === 0) {
        toast.error(
          'Nenhum dado encontrado na planilha. Verifique se a aba BASE_GERAL contém dados.',
        )
      } else {
        toast.success(
          `Sincronização concluída: ${result.rowsRead} linhas lidas, ${result.rowsSaved} registros gravados.`,
        )
      }
      loadHistory()
    } catch (err: any) {
      const message =
        err instanceof Error
          ? err.message
          : err?.response?.error ||
            err?.message ||
            'Erro ao sincronizar com a planilha. Tente novamente.'
      toast.error(message)
    } finally {
      setSyncing(false)
    }
  }
  const lastSync = history.find((h) => h.status === 'success')
  const lastSyncDate = lastSync
    ? format(new Date(lastSync.execution_date || lastSync.created), "dd/MM/yyyy 'às' HH:mm")
    : null

  return (
    <>
      <Card className="border-border/40 bg-card/50 backdrop-blur">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex flex-col gap-2">
            <Button onClick={handleSync} disabled={syncing} size="sm" className="w-fit gap-2">
              <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Planilha'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Importa os dados da planilha do Google Sheets. Para grandes volumes, pode levar alguns
              minutos.
            </p>
            {syncing && (
              <p className="animate-fade-in text-xs text-primary/80">
                Processando dados... A sincronização pode levar alguns minutos para grandes volumes.
              </p>
            )}
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            {lastSyncDate && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Última sincronização: {lastSyncDate}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              Histórico
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de Sincronização</DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum registro de sincronização encontrado.
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Data/Hora</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Linhas Lidas</TableHead>
                    <TableHead className="text-right">Gravados</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => {
                    const date = format(new Date(h.execution_date || h.created), 'dd/MM/yyyy HH:mm')
                    return (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs font-medium">{date}</TableCell>
                        <TableCell>
                          <Badge
                            variant={h.status === 'success' ? 'default' : 'destructive'}
                            className="gap-1"
                          >
                            {h.status === 'success' ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                Sucesso
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" />
                                Erro
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {h.rows_read?.toLocaleString('pt-BR') ?? 0}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {h.rows_saved?.toLocaleString('pt-BR') ?? 0}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {h.error_log || '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
