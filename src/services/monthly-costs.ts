import pb from '@/lib/pocketbase/client'

export interface MonthlyCost {
  id: string
  month: string
  name: string
  category: string
  amount: number
  sourceId: string
  created: string
  updated: string
}

export const getMonthlyCosts = async (month: string): Promise<MonthlyCost[]> => {
  return await pb.collection('monthly_costs').getFullList<MonthlyCost>({
    filter: `month = "${month}"`,
    sort: 'category,name',
  })
}

export const createMonthlyCost = async (data: Partial<MonthlyCost>) => {
  return await pb.collection('monthly_costs').create<MonthlyCost>(data)
}

export const updateMonthlyCost = async (id: string, data: Partial<MonthlyCost>) => {
  return await pb.collection('monthly_costs').update<MonthlyCost>(id, data)
}

export const deleteMonthlyCost = async (id: string) => {
  return await pb.collection('monthly_costs').delete(id)
}
