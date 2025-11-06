'use client';
import { Suspense } from 'react';
import CampaignsDeletedPage from '../../_pages/CampaignsDeletedPage';

/**
 * Технический враппер: оборачиваем возможный useSearchParams()
 * в <Suspense>. Логика/верстка страницы не меняются.
 */
export default function CampaignsDeletedPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CampaignsDeletedPage />
    </Suspense>
  );
}
