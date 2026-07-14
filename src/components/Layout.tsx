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
import { RefreshCcw, Clapperboard } from 'lucide-react'
import { format } from 'date-fns'

export default function Layout() {
  const { months, selectedMonth, setSelectedMonth, lastUpdated, loading, refetch } =
    useDashboardContext()

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Clapperboard className="h-6 w-6 text-primary" strokeWidth={1.5} />
            <h1 className="font-sans text-lg font-bold tracking-tight text-foreground hidden sm:block">
              Production Analytics
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2 hidden md:flex">
              <RefreshCcw
                className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}
                strokeWidth={1.5}
              />
              <span>
                Última atualização: hoje às{' '}
                {lastUpdated ? `${format(lastUpdated, 'HH:mm')}h` : '--:--h'}
              </span>
            </div>

            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={loading}>
              <SelectTrigger className="w-[160px] sm:w-[200px] rounded-full bg-muted/50 border-transparent hover:bg-muted font-medium transition-colors">
                <SelectValue placeholder="Mês de Faturamento" />
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
