import { Suspense } from 'react';
import NotFoundClient from '@/app/_pages/NotFoundClient';

export const dynamic = 'force-dynamic';

export default function NotFoundPage() {
  return (
    <Suspense fallback={null}>
      <NotFoundClient />
    </Suspense>
  );
}
