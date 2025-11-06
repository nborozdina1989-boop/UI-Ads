import { Suspense } from 'react';
import CampaignNewPage from '@/app/_pages/CampaignNewPage';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CampaignNewPage />
    </Suspense>
  );
}
