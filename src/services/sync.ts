import pb from '@/lib/pocketbase/client'

export interface SyncAcceptanceResult {
  passed: boolean
  details: string[]
}

export interface SyncPullResponse {
  message: string
  rowsRead: number
  rowsSaved: number
  created: number
  updated: number
  skipped: number
  failed: number
  dbCount: number
  status: string
  acceptance?: SyncAcceptanceResult
}

export const syncPullSheets = async (force: boolean = false): Promise<SyncPullResponse> => {
  return await pb.send('/backend/v1/sync-pull-sheets', {
    method: 'POST',
    body: JSON.stringify({ force }),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const triggerManualSync = syncPullSheets
