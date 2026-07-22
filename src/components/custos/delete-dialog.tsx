import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

interface DeleteDialogProps {
  open: boolean
  itemName: string
  isRecurring: boolean
  onConfirm: (removeFromFuture: boolean) => void
  onCancel: () => void
}

export function DeleteDialog({
  open,
  itemName,
  isRecurring,
  onConfirm,
  onCancel,
}: DeleteDialogProps) {
  const [removeFromFuture, setRemoveFromFuture] = useState(false)

  useEffect(() => {
    if (!open) setRemoveFromFuture(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover item?</DialogTitle>
          <DialogDescription>
            Remover {itemName}? Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>
        {isRecurring && (
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              checked={removeFromFuture}
              onCheckedChange={(v) => setRemoveFromFuture(!!v)}
              id="remove-future"
            />
            <label htmlFor="remove-future" className="text-sm cursor-pointer">
              Remover também dos próximos meses
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(removeFromFuture)}>
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
