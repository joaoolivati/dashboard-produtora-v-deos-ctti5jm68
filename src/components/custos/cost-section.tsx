import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBRLInput, parseBRLInput, handleBRLInputChange } from '@/lib/brl-input'
import { DeleteDialog } from '@/components/custos/delete-dialog'
import { useCostControl } from '@/contexts/cost-control-context'
import { usePrivacy } from '@/contexts/privacy-context'
import { costItemSchema } from '@/lib/cost-schemas'
import { Plus, Pencil, Trash2, Check, X, Repeat } from 'lucide-react'
import { toast } from 'sonner'

interface CostSectionProps {
  category: string
  title: string
  allowRecurring: boolean
  caption?: string
}

export function CostSection({ category, title, allowRecurring, caption }: CostSectionProps) {
  const { monthlyCosts, loading, addCost, updateCost, deleteCost } = useCostControl()
  const { formatCurrency } = usePrivacy()
  const items = monthlyCosts.filter((m) => m.category === category)
  const subtotal = items.reduce((s, m) => s + m.amount, 0)
  const peopleCount = category === 'salario' ? items.length : undefined

  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addAmountStr, setAddAmountStr] = useState(formatBRLInput(0))
  const [addRecurring, setAddRecurring] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmountStr, setEditAmountStr] = useState('')
  const [editRecurring, setEditRecurring] = useState(false)
  const [delTarget, setDelTarget] = useState<{
    id: string
    name: string
    isRecurring: boolean
  } | null>(null)

  const handleAdd = async () => {
    const addAmount = parseBRLInput(addAmountStr)
    const parsed = costItemSchema.safeParse({ name: addName, amount: addAmount })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message)
      return
    }
    await addCost({ ...parsed.data, category, recurring: allowRecurring ? addRecurring : false })
    setAddName('')
    setAddAmountStr(formatBRLInput(0))
    setShowAdd(false)
    setAddRecurring(true)
  }

  const handleEdit = async () => {
    if (!editId) return
    const editAmount = parseBRLInput(editAmountStr)
    const parsed = costItemSchema.safeParse({ name: editName, amount: editAmount })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message)
      return
    }
    await updateCost(editId, { ...parsed.data, recurring: allowRecurring ? editRecurring : false })
    setEditId(null)
  }

  const handleDelete = async (removeFromFuture: boolean) => {
    if (!delTarget) return
    await deleteCost(delTarget.id, removeFromFuture)
    setDelTarget(null)
  }

  if (loading) {
    return (
      <Card className="glass">
        <CardContent className="p-6 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="glass animate-fade-in-up">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              {title}
              {peopleCount !== undefined && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  · {peopleCount} {peopleCount === 1 ? 'pessoa' : 'pessoas'}
                </span>
              )}
            </CardTitle>
            <span className="text-sm font-mono text-muted-foreground">
              {formatCurrency(subtotal)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {items.map((item) =>
            editId === item.id ? (
              <div key={item.id} className="flex items-center gap-2 py-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8"
                  placeholder="Nome"
                />
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    R$
                  </span>
                  <Input
                    value={editAmountStr}
                    onChange={(e) => setEditAmountStr(handleBRLInputChange(e.target.value))}
                    className="h-8 w-32 pl-7 font-mono"
                    inputMode="decimal"
                  />
                </div>
                {allowRecurring && (
                  <div className="flex items-center gap-1 px-1">
                    <Switch checked={editRecurring} onCheckedChange={setEditRecurring} />
                    <Repeat className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleEdit}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditId(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div
                key={item.id}
                className="flex items-center gap-2 group py-1 px-1 rounded hover:bg-muted/50 transition-colors"
              >
                <span className="flex-1 text-sm">{item.name}</span>
                {item.sourceId && allowRecurring && (
                  <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-mono">{formatCurrency(item.amount)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 h-7 w-7 transition-opacity"
                  onClick={() => {
                    setEditId(item.id)
                    setEditName(item.name)
                    setEditAmountStr(formatBRLInput(item.amount))
                    setEditRecurring(!!item.sourceId)
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 h-7 w-7 transition-opacity"
                  onClick={() =>
                    setDelTarget({
                      id: item.id,
                      name: item.name,
                      isRecurring: !!item.sourceId && allowRecurring,
                    })
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ),
          )}

          {showAdd ? (
            <div className="flex items-center gap-2 pt-2 mt-1 border-t">
              <Input
                placeholder="Nome"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="h-8"
              />
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  R$
                </span>
                <Input
                  value={addAmountStr}
                  onChange={(e) => setAddAmountStr(handleBRLInputChange(e.target.value))}
                  className="h-8 w-32 pl-7 font-mono"
                  inputMode="decimal"
                  placeholder={formatBRLInput(0)}
                />
              </div>
              {allowRecurring && (
                <div className="flex items-center gap-1 px-1">
                  <Switch checked={addRecurring} onCheckedChange={setAddRecurring} />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Recorrente
                  </span>
                </div>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAdd}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setShowAdd(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground mt-1"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          )}
          {caption && <p className="text-xs text-muted-foreground pt-2">{caption}</p>}
        </CardContent>
      </Card>

      <DeleteDialog
        open={!!delTarget}
        itemName={delTarget?.name || ''}
        isRecurring={delTarget?.isRecurring || false}
        onConfirm={handleDelete}
        onCancel={() => setDelTarget(null)}
      />
    </>
  )
}
