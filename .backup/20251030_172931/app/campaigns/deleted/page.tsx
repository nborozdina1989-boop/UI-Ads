import { Suspense } from 'react';
import RkTabs from '@/components/RkTabs';
import ClientSearchFiltersBar from '@/components/ClientSearchFiltersBar';
import CampaignsDeletedPage from '@/app/_pages/CampaignsDeletedPage';

export default function Page(){
  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <RkTabs/>
      </Suspense>
      <ClientSearchFiltersBar/>
      <Suspense fallback={null}>
        <CampaignsDeletedPage/>
      </Suspense>
    </div>
  );
}
