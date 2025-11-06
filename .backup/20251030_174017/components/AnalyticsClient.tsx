'use client';
import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { track } from '@vercel/analytics';

function VisitTracker() {
  useEffect(() => {
    try {
      const path = window.location.pathname + window.location.search;
      if (!sessionStorage.getItem('sid')) {
        sessionStorage.setItem('sid', Math.random().toString(36).slice(2));
      }
      const sid = sessionStorage.getItem('sid')!;
      const key = `seen:${sid}:${path}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        // Отправим событие в Vercel Analytics
        track('visit', { path });

        // Локальные счётчики: всего и по маршруту (для DEBUG-бейджа)
        const inc = (k:string) =>
          localStorage.setItem(k, String(1 + Number(localStorage.getItem(k) || '0')));
        inc('visits:all');
        inc(`visits:${path}`);
      }
    } catch {}
  }, []);
  return null;
}

export default function AnalyticsClient() {
  return (
    <>
      <Analytics />
      <VisitTracker />
    </>
  );
}
