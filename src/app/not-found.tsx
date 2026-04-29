// Серверный компонент без хуков — безопасен для SSG/SSR
import Link from "next/link";

export const dynamic = 'force-static';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-[56px] font-extrabold leading-none text-sky-800">404</div>
      <h1 className="text-2xl font-semibold text-sky-800">Страница не найдена</h1>
      <p className="text-slate-600">Похоже, такой страницы нет или она была перемещена.</p>
      <div className="flex items-center gap-3">
        <Link href="/" className="rounded-xl bg-sky-600 px-4 py-2 text-white transition hover:bg-sky-700">На главную</Link>
        <Link href="/campaigns" className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition">К списку РК</Link>
      </div>
    </div>
  );
}
