'use client';
import { useEffect, useState } from 'react';

export default function VisitBadge() {
  const [show, setShow] = useState(false);
  const [counts, setCounts] = useState<{all:number; path:number; pathKey:string}>({all:0,path:0,pathKey:''});

  useEffect(()=>{
    try {
      const url = new URL(window.location.href);
      const isDebug = url.searchParams.get('debug') === '1';
      setShow(isDebug);
      if (!isDebug) return;

      // Уберём сам параметр из ключа пути
      url.searchParams.delete('debug');
      const path = url.pathname + (url.search ? url.search : '');
      const kAll = 'visits:all';
      const kPath = `visits:${path}`;
      setCounts({
        all: Number(localStorage.getItem(kAll) || '0'),
        path: Number(localStorage.getItem(kPath) || '0'),
        pathKey: kPath,
      });
    } catch {}
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position:'fixed', right:12, bottom:12, background:'#0f172acc',
      color:'#fff', padding:'8px 10px', borderRadius:10, fontSize:12, zIndex:9999
    }}>
      <div><strong>DEBUG · Счётчик</strong></div>
      <div>Всего уник. посещений (сессии): {counts.all}</div>
      <div>Текущий путь: {counts.path}</div>
    </div>
  );
}
