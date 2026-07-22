import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth()
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!loading && isAuthenticated && !isAdmin) {
      toast.error('Acesso restrito ao administrador.')
    }
  }, [loading, isAuthenticated, isAdmin])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
