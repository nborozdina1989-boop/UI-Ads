'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

function NavTab({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={[
        'shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition',
        active
          ? 'bg-sky-600 text-white shadow-sm'
          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

export default function MediaplanLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const isCreate = pathname.endsWith('/create');
  const isUpload = pathname.startsWith('/mediaplan/upload') && !isCreate;
  const isList =
    pathname === '/mediaplan' ||
    (/^\/mediaplan\/[^/]+$/.test(pathname) && !isUpload);

  if (isUpload) {
    return (
      <div className="bg-white pb-20 sm:pb-6">
        <div className="mx-auto flex max-w-[1920px] gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none] sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 gap-2">
            <NavTab href="/mediaplan" active={isList}>Список медиапланов</NavTab>
            <NavTab href="/mediaplan/upload" active={isUpload}>Загрузить медиаплан</NavTab>
            <NavTab href="/mediaplan/upload/create" active={isCreate}>Создать медиаплан</NavTab>
            <Link
              href="/mediaplan/drafts"
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Черновики
            </Link>
          </div>
          <div className="ml-auto flex shrink-0 gap-2">
            <Link
              href="/mediaplan"
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              К списку медиапланов
            </Link>
            <Link
              href="/campaigns"
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              К списку РК
            </Link>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="px-4 pb-20 pt-6 sm:px-6 sm:pb-6">
      <div className="mb-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <NavTab href="/mediaplan" active={isList}>Список медиапланов</NavTab>
            <NavTab href="/mediaplan/upload" active={isUpload}>Загрузить медиаплан</NavTab>
            <NavTab href="/mediaplan/upload/create" active={isCreate}>Создать медиаплан</NavTab>
            <Link
              href="/mediaplan/drafts"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Черновики
            </Link>
          </div>
          {isUpload && (
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              <Link
                href="/mediaplan"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                К списку медиапланов
              </Link>
              <Link
                href="/campaigns"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                К списку РК
              </Link>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
