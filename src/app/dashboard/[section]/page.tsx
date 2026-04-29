import { Suspense } from 'react';
import DashboardClientPage from '@/app/_pages/DashboardClientPage';

export const dynamic = 'force-dynamic';

export default function SectionPage() {
  return (
    <Suspense fallback={null}>
      <DashboardClientPage />
    </Suspense>
  );
}
