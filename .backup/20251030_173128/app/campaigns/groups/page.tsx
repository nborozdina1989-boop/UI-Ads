import RkTabs from '@/components/RkTabs'
import ClientSearchFiltersBar from '@/components/ClientSearchFiltersBar'
import CampaignsGroupsPage from '@/app/_pages/CampaignsGroupsPage'

export default function Page() {
  return (
    <div className="space-y-4">
      <RkTabs active="groups" />
      <ClientSearchFiltersBar />
      <CampaignsGroupsPage />
    </div>
  )
}
