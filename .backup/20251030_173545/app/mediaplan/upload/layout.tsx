'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function UploadLayout({ children }: { children: ReactNode }) {
  const p = usePathname();
  const isCreate = p?.endsWith('/create');

  const Tab = ({ href, active, children }:{href:string;active:boolean;children:ReactNode}) => (
    <Link
      href={href}
      className={`px-4 py-2 rounded-t-lg border-b-2 ${
        active ? 'border-[#0078D7] text-[#0078D7]' : 'border-transparent text-slate-600 hover:text-slate-800'
      }`}
    >
      {children}
    </Link>
  );

  return (
    <div className="p-0">
      <div className="border-b bg-white px-6 pt-6">
        <h1 className="text-xl font-semibold text-slate-900 mb-4">Медиаплан</h1>
        <div className="flex gap-2">
          <Tab href="/mediaplan/upload" active={!isCreate}>Загрузить медиаплан</Tab>
          <Tab href="/mediaplan/upload/create" active={!!isCreate}>Создать медиаплан</Tab>
        </div>
      </div>
      <div className="px-6 pb-6 pt-4">
        {children}
      </div>
    </div>
  );
}
