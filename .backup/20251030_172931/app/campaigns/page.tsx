import { Suspense } from 'react';
import RkTabs from '@/components/RkTabs';
import ClientSearchFiltersBar from '@/components/ClientSearchFiltersBar';
import CampaignsPage from '@/app/_pages/CampaignsPage';

export default function Page(){
  return (
    <div className="space-y-4">
      <Suspense fallback={null}>
        <RkTabs/>
      </Suspense>
      <ClientSearchFiltersBar/>
      <Suspense fallback={null}>
        <CampaignsPage/>
      </Suspense>
    </div>
  );
}
