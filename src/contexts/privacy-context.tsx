import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import { formatCurrency as formatCurrencyBase } from '@/lib/utils'

interface PrivacyContextState {
  isPrivacyMode: boolean
  togglePrivacy: () => void
  formatCurrency: (value: number) => string
}

const PrivacyContext = createContext<PrivacyContextState | undefined>(undefined)

const STORAGE_KEY = 'dashboard-privacy-mode'

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  )

  const togglePrivacy = useCallback(() => {
    setIsPrivacyMode((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const formatCurrency = useCallback(
    (value: number) => {
      if (isPrivacyMode) return 'R$ ••••'
      return formatCurrencyBase(value)
    },
    [isPrivacyMode],
  )

  return (
    <PrivacyContext.Provider value={{ isPrivacyMode, togglePrivacy, formatCurrency }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (!context) throw new Error('usePrivacy must be used within a PrivacyProvider')
  return context
}
