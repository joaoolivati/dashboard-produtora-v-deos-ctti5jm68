import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePrivacy } from '@/contexts/privacy-context'

export function PrivacyToggle() {
  const { isPrivacyMode, togglePrivacy } = usePrivacy()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={togglePrivacy}
      className="rounded-full"
      aria-label="Toggle financial privacy"
      title={isPrivacyMode ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
    >
      {isPrivacyMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </Button>
  )
}
