import pb from '@/lib/pocketbase/client'

export interface SyncResult {
  message: string
  rowsRead: number
  rowsSaved: number
  status: string
  error?: string
}

export const triggerManualSync = async (): Promise<SyncResult> => {
  try {
    return await pb.send('/backend/v1/sync-pull-sheets', {
      method: 'POST',
    })
  } catch (err: any) {
    const message =
      err?.response?.error || err?.message || 'Erro ao sincronizar com a planilha. Tente novamente.'
    throw new Error(message)
  }
}
