import pb from '@/lib/pocketbase/client'

export interface SyncResult {
  message: string
  inserted: number
  totalParsed: number
}

export const triggerManualSync = async (): Promise<SyncResult> => {
  return await pb.send('/backend/v1/sync-pull-sheets', {
    method: 'POST',
  })
}
