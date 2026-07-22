import { Outlet, Link, useLocation } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { PrivacyToggle } from './PrivacyToggle'
import { useDashboardContext } from '@/contexts/dashboard-context'
import { useAuth } from '@/hooks/use-auth'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  RefreshCcw,
  Clapperboard,
  Video,
  LogOut,
  Wallet,
  LayoutDashboard,
  Menu,
} from 'lucide-react'
import { format, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { useState } from 'react'

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth()
  const location = useLocation()
  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ...(user?.role === 'admin' ? [{ to: '/custos', label: 'Custos', icon: Wallet }] : []),
  ]
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 h-16 border-b shrink-0">
        <Clapperboard className="h-6 w-6 text-primary shrink-0" strokeWidth={1.5} />
        <span className="font-sans text-base font-bold tracking-tight">Production Analytics</span>
      </div>
      <nav className="flex-1 p-3">
        {links.map((link) => {
          const isActive = location.pathname === link.to
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <link.icon className="h-4 w-4" strokeWidth={1.5} />
              {link.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

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
  } = useDashboardContext()
  const { signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background flex font-sans">
      <aside className="hidden md:flex w-60 flex-col border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <SidebarContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
          <div className="container flex h-16 items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden rounded-full"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" strokeWidth={1.5} />
              </Button>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground hidden lg:flex">
                <RefreshCcw
                  className={cn('h-3 w-3', loading && 'animate-spin')}
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
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
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

              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="rounded-full"
                title="Sair"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </Button>
              <PrivacyToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 container py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
