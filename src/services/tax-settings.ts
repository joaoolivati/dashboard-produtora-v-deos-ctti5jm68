import pb from '@/lib/pocketbase/client'

export interface TaxSettings {
  id: string
  month: string
  percentage: number
  rbt12: number
  nominalRate: number
  deduction: number
  created: string
  updated: string
}

export const getTaxSettings = async (month: string): Promise<TaxSettings | null> => {
  try {
    return await pb.collection('tax_settings').getFirstListItem<TaxSettings>(`month = "${month}"`)
  } catch {
    return null
  }
}

export const getInheritedTaxRate = async (
  currentMonth: string,
): Promise<{ rate: number; sourceMonth: string } | null> => {
  try {
    const records = await pb.collection('tax_settings').getFullList<TaxSettings>({
      filter: `month < "${currentMonth}"`,
      sort: '-month',
    })
    if (records.length > 0) {
      return { rate: records[0].percentage || 0, sourceMonth: records[0].month }
    }
    return null
  } catch {
    return null
  }
}

export const upsertTaxSettings = async (
  month: string,
  data: { percentage?: number; rbt12?: number; nominalRate?: number; deduction?: number },
): Promise<TaxSettings> => {
  try {
    const existing = await pb
      .collection('tax_settings')
      .getFirstListItem<TaxSettings>(`month = "${month}"`)
    return await pb.collection('tax_settings').update<TaxSettings>(existing.id, data)
  } catch {
    return await pb.collection('tax_settings').create<TaxSettings>({ month, ...data })
  }
}
