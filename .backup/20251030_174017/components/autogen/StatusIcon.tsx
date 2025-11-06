'use client';
export function StatusIcon({status}:{status:'ok'|'warn'|'dirty'}) {
  if (status === 'ok') return <span title="ОК" className="text-green-600">✔︎</span>;
  if (status === 'dirty') return <span title="Есть неприменённые правки" className="text-purple-600">●</span>;
  return <span title="Не найдено" className="text-amber-500">⚠️</span>;
}
