import { Suspense } from 'react';
import RkTabs from '@/components/RkTabs';
import ClientSearchFiltersBar from '@/components/ClientSearchFiltersBar';
import CampaignGroupsPage from '@/app/_pages/CampaignGroupsPage';

export default function Page(){
  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <RkTabs/>
      </Suspense>
      <ClientSearchFiltersBar/>
      <Suspense fallback={null}>
        <CampaignGroupsPage/>
      </Suspense>
    </div>
  );
}
