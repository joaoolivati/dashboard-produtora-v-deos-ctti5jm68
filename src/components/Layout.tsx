import { Outlet } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { useDashboardContext } from '@/contexts/dashboard-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCcw, Clapperboard, Video } from 'lucide-react'
import { format, isToday } from 'date-fns'

export default function Layout() {
  const {
    months,
    selectedMonth,
    setSelectedMonth,
    videoTypes,
    selectedVideoType,
    setSelectedVideoType,
    lastUpdated,
    loading,
    refetch,
  } = useDashboardContext()

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container flex h-16 items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Clapperboard className="h-6 w-6 text-primary shrink-0" strokeWidth={1.5} />
            <h1 className="font-sans text-lg font-bold tracking-tight text-foreground hidden sm:block">
              Production Analytics
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1 hidden lg:flex">
              <RefreshCcw
                className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}
                strokeWidth={1.5}
              />
              <span>
                Última atualização:{' '}
                {lastUpdated
                  ? isToday(lastUpdated)
                    ? `hoje às ${format(lastUpdated, 'HH:mm')}h`
                    : `${format(lastUpdated, 'dd/MM às HH:mm')}h`
                  : '--:--'}
              </span>
            </div>

            <Select value={selectedVideoType} onValueChange={setSelectedVideoType}>
              <SelectTrigger className="w-[130px] sm:w-[160px] rounded-full bg-muted/50 border-transparent hover:bg-muted font-medium transition-colors">
                <Video className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" strokeWidth={1.5} />
                <SelectValue placeholder="Tipo de Vídeo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {videoTypes.map((vt) => (
                  <SelectItem key={vt} value={vt}>
                    {vt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loading}>
              <SelectTrigger className="w-[130px] sm:w-[180px] rounded-full bg-muted/50 border-transparent hover:bg-muted font-medium transition-colors">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {months.length === 0 && (
                  <SelectItem value="none" disabled>
                    Nenhum mês
                  </SelectItem>
                )}
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <Outlet />
      </main>
    </div>
  )
}
