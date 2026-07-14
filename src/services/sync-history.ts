import pb from '@/lib/pocketbase/client'

export interface SyncHistoryRecord {
  id: string
  status: string
  rows_read: number
  rows_saved: number
  error_log: string
  execution_date: string
  created: string
  updated: string
}

export const getSyncHistory = async (limit: number = 10): Promise<SyncHistoryRecord[]> => {
  const result = await pb.collection('sync_history').getList<SyncHistoryRecord>(1, limit, {
    sort: '-execution_date',
  })
  return result.items
}

export const getLatestSuccessfulSync = async (): Promise<SyncHistoryRecord | null> => {
  const result = await pb.collection('sync_history').getList<SyncHistoryRecord>(1, 1, {
    sort: '-execution_date',
    filter: "status = 'success'",
  })
  return result.items[0] || null
}
