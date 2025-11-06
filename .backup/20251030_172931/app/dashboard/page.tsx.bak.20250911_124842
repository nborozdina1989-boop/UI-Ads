'use client';
import { Suspense } from 'react';
import DashboardPage from '../_pages/DashboardPage';

/**
 * Технический враппер: только чтобы удовлетворить требование Next.js
 * оборачивать useSearchParams() в <Suspense>. Логика/верстка не меняются.
 */
export default function DashboardPageWrapper() {
  return (
    <Suspense fallback={null}>
      <DashboardPage />
    </Suspense>
  );
}
