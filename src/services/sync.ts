import { z } from 'zod'
import pb from '@/lib/pocketbase/client'

const syncResultSchema = z.object({
  message: z.string(),
  rowsRead: z.number(),
  rowsSaved: z.number(),
  status: z.string(),
  error: z.string().optional(),
  created: z.number().optional(),
  updated: z.number().optional(),
  skipped: z.number().optional(),
  skippedNoId: z.number().optional(),
})

export type SyncResult = z.infer<typeof syncResultSchema>

export const triggerManualSync = async (): Promise<SyncResult> => {
  try {
    const result = await pb.send('/backend/v1/sync-pull-sheets', {
      method: 'POST',
    })
    const parsed = syncResultSchema.safeParse(result)
    if (parsed.success) {
      return parsed.data
    }
    return {
      message: 'Resposta inesperada do servidor',
      rowsRead: 0,
      rowsSaved: 0,
      status: 'error',
    }
  } catch (err: unknown) {
    const e = err as {
      message?: string
      response?: { error?: string; message?: string }
      isAbort?: boolean
    }
    const isNetworkError =
      e?.message === 'Failed to fetch' ||
      e?.message?.includes('NetworkError') ||
      e?.message?.includes('network') ||
      e?.isAbort

    if (isNetworkError) {
      throw new Error(
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      )
    }

    const message =
      e?.response?.error ||
      e?.response?.message ||
      e?.message ||
      'Erro ao sincronizar com a planilha. Tente novamente.'
    throw new Error(message)
  }
}
