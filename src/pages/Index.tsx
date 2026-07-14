import { SummaryCards } from '@/components/dashboard/summary-cards'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { RankingLists } from '@/components/dashboard/ranking-lists'

export default function Index() {
  return (
    <div className="flex flex-col gap-8 pb-8">
      <SummaryCards />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <RevenueChart />
        </div>
        <div className="lg:col-span-4">
          <RankingLists />
        </div>
      </div>
    </div>
  )
}
