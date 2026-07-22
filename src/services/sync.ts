import pb from '@/lib/pocketbase/client'

export interface SyncResult {
  message: string
  rowsRead: number
  rowsSaved: number
  status: string
  error?: string
  created?: number
  updated?: number
  skipped?: number
}

export const triggerManualSync = async (): Promise<SyncResult> => {
  try {
    const result = await pb.send('/backend/v1/sync-pull-sheets', {
      method: 'POST',
    })
    return result as SyncResult
  } catch (err: any) {
    const isNetworkError =
      err?.message === 'Failed to fetch' ||
      err?.message?.includes('NetworkError') ||
      err?.message?.includes('network') ||
      err?.isAbort

    if (isNetworkError) {
      throw new Error(
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      )
    }

    const message =
      err?.response?.error ||
      err?.response?.message ||
      err?.message ||
      'Erro ao sincronizar com a planilha. Tente novamente.'
    throw new Error(message)
  }
}
