import { SummaryCards } from '@/components/dashboard/summary-cards'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { RankingLists } from '@/components/dashboard/ranking-lists'
import { ProjectionCard } from '@/components/dashboard/projection-card'
import { SyncPanel } from '@/components/dashboard/sync-panel'
import { ExportCsvButton } from '@/components/dashboard/export-csv-button'

export default function Index() {
  return (
    <div className="flex flex-col gap-8 pb-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SyncPanel />
        <ExportCsvButton />
      </div>
      <SummaryCards />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <RevenueChart />
        </div>
        <div className="lg:col-span-4 flex flex-col gap-6">
          <ProjectionCard />
          <RankingLists />
        </div>
      </div>
    </div>
  )
}
