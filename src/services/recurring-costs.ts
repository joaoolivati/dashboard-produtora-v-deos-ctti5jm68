import pb from '@/lib/pocketbase/client'

export interface RecurringCost {
  id: string
  name: string
  category: string
  amount: number
  active: boolean
  created: string
  updated: string
}

export const getRecurringCosts = async (): Promise<RecurringCost[]> => {
  return await pb.collection('recurring_costs').getFullList<RecurringCost>({
    sort: 'category,name',
  })
}

export const createRecurringCost = async (data: Partial<RecurringCost>) => {
  return await pb.collection('recurring_costs').create<RecurringCost>(data)
}

export const updateRecurringCost = async (id: string, data: Partial<RecurringCost>) => {
  return await pb.collection('recurring_costs').update<RecurringCost>(id, data)
}

export const deleteRecurringCost = async (id: string) => {
  return await pb.collection('recurring_costs').delete(id)
}
