import { Suspense } from 'react';
import GenerationClientPage from '@/app/_pages/GenerationClientPage';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GenerationClientPage />
    </Suspense>
  );
}
