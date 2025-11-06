import { Suspense } from 'react';
import AutogenClientPage from '@/app/_pages/AutogenClientPage';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AutogenClientPage />
    </Suspense>
  );
}
