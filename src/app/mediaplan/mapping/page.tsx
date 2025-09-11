import { Suspense } from 'react';
import MediaplanMappingPage from '@/app/_pages/MediaplanMappingPage';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MediaplanMappingPage />
    </Suspense>
  );
}
