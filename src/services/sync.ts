import pb from '@/lib/pocketbase/client'

export interface SyncResult {
  message: string
  rowsRead: number
  rowsSaved: number
  status: string
}

export const triggerManualSync = async (): Promise<SyncResult> => {
  return await pb.send('/backend/v1/sync-pull-sheets', {
    method: 'POST',
  })
}
