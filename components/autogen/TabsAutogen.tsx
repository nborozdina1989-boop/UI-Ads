'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function TabsAutogen(){
  const path = usePathname();
  const base = path.startsWith('/generation') ? '/generation' : '/autogen';
  const isGen = path === base;
  const isCodes = path === `${base}/codes`;
  const baseCls = "px-3 py-1.5 rounded-md border text-sm";
  return (
    <div className="flex gap-2">
      <Link href={base} className={`${baseCls} ${isGen?'bg-slate-900 text-white':'bg-white'}`}>Генерация</Link>
      <Link href={`${base}/codes`} className={`${baseCls} ${isCodes?'bg-slate-900 text-white':'bg-white'}`}>Коды</Link>
    </div>
  );
}
