import pb from '@/lib/pocketbase/client'

export interface TaxSettings {
  id: string
  month: string
  percentage: number
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

export const upsertTaxSettings = async (
  month: string,
  percentage: number,
): Promise<TaxSettings> => {
  try {
    const existing = await pb
      .collection('tax_settings')
      .getFirstListItem<TaxSettings>(`month = "${month}"`)
    return await pb.collection('tax_settings').update<TaxSettings>(existing.id, { percentage })
  } catch {
    return await pb.collection('tax_settings').create<TaxSettings>({ month, percentage })
  }
}
