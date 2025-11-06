'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/mediaplan/upload", label: "Загрузить медиаплан" },
  { href: "/mediaplan/upload/create", label: "Создать медиаплан" },
];

export default function TabNav() {
  const p = usePathname();
  return (
    <div className="border-b">
      <nav className="flex gap-2">
        {tabs.map(t => {
          const active = p === t.href;
          const cls = active
            ? "px-3 py-2 border-b-2 border-[#0078D7] text-[#0078D7] font-medium"
            : "px-3 py-2 text-gray-600 hover:text-gray-900";
          return (
            <Link key={t.href} href={t.href} className={cls}>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
