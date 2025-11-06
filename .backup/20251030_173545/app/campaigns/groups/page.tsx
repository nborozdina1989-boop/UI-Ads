import { Suspense } from 'react'
import RkTabs from '@/components/RkTabs'
import ClientSearchFiltersBar from '@/components/ClientSearchFiltersBar'
import CampaignsGroupsPage from '@/app/_pages/CampaignsGroupsPage'

export default function Page() {
  return (
    <div className="space-y-4">
      <RkTabs active="groups" />
      <Suspense>
        <ClientSearchFiltersBar />
      </Suspense>
      <Suspense>
        <CampaignsGroupsPage />
      </Suspense>
    </div>
  )
}
