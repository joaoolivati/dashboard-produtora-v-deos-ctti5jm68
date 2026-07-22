import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
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

  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [addRecurring, setAddRecurring] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editRecurring, setEditRecurring] = useState(false)
  const [delId, setDelId] = useState<string | null>(null)

  const handleAdd = async () => {
    const parsed = costItemSchema.safeParse({ name: addName, amount: parseFloat(addAmount) || 0 })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message)
      return
    }
    await addCost({ ...parsed.data, category, recurring: allowRecurring ? addRecurring : false })
    setAddName('')
    setAddAmount('')
    setShowAdd(false)
    setAddRecurring(true)
  }

  const handleEdit = async () => {
    if (!editId) return
    const parsed = costItemSchema.safeParse({ name: editName, amount: parseFloat(editAmount) || 0 })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message)
      return
    }
    await updateCost(editId, { ...parsed.data, recurring: allowRecurring ? editRecurring : false })
    setEditId(null)
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
    <Card className="glass animate-fade-in-up">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
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
              />
              <Input
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                type="number"
                className="h-8 w-28"
              />
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
          ) : delId === item.id ? (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5">
              <span className="text-xs text-muted-foreground flex-1">
                Remover dos próximos meses também?
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  deleteCost(item.id, true)
                  setDelId(null)
                }}
              >
                Sim
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  deleteCost(item.id, false)
                  setDelId(null)
                }}
              >
                Só este mês
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDelId(null)}>
                Cancelar
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
                  setEditAmount(String(item.amount))
                  setEditRecurring(!!item.sourceId)
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 h-7 w-7 transition-opacity"
                onClick={() => {
                  if (item.sourceId && allowRecurring) {
                    setDelId(item.id)
                  } else {
                    deleteCost(item.id, false)
                  }
                }}
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
            <Input
              placeholder="Valor"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              type="number"
              className="h-8 w-28"
            />
            {allowRecurring && (
              <div className="flex items-center gap-1 px-1">
                <Switch checked={addRecurring} onCheckedChange={setAddRecurring} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Recorrente</span>
              </div>
            )}
            <Button size="icon" className="h-7 w-7" onClick={handleAdd}>
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
  )
}
