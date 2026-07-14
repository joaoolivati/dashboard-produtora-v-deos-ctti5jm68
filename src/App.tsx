import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import Layout from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ThemeProvider } from './components/theme-provider'
import { DashboardProvider } from './contexts/dashboard-context'
import { AuthProvider } from '@/hooks/use-auth'
import { applyCssRulesSecurityPatch } from '@/lib/css-rules-patch'

applyCssRulesSecurityPatch()

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="dashboard-theme">
    <AuthProvider>
      <PrivacyProvider>
        <BrowserRouter>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedRoute />}>
                <Route
                  element={
                    <DashboardProvider>
                      <Layout />
                    </DashboardProvider>
                  }
                >
                  <Route path="/" element={<Index />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </BrowserRouter>
      </PrivacyProvider>
    </AuthProvider>
  </ThemeProvider>
)

export default App
