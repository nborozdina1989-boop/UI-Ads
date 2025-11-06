'use client';
import Script from 'next/script';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const YM_ID = 104116302; // из твоего сниппета

export default function YandexMetrika() {
  const pathname = usePathname();
  const params = useSearchParams();
  const url = (pathname || '/') + (params?.toString() ? `?${params}` : '');

  // Отправка "хита" при смене роута (SPA)
  useEffect(() => {
    try {
      // @ts-ignore
      if (typeof window !== 'undefined' && typeof window.ym === 'function') {
        // @ts-ignore
        window.ym(YM_ID, 'hit', url);
      }
    } catch {}
  }, [url]);

  return (
    <>
      {/* Твой загрузчик тега (с проверкой на дубликат) */}
      <Script id="ym-loader" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < e.scripts.length; j++) { if (e.scripts[j].src === r) { return; } }
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window, document,'script','https://mc.webvisor.org/metrika/tag_ww.js?id=${YM_ID}', 'ym');`}
      </Script>

      {/* Инициализация счётчика с твоими опциями */}
      <Script id="ym-init" strategy="afterInteractive">
        {`ym(${YM_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});`}
      </Script>

      {/* noscript-пиксель */}
      <noscript>
        <div>
          <img src={`https://mc.yandex.ru/watch/${YM_ID}`} style={{position:'absolute', left:'-9999px'}} alt="" />
        </div>
      </noscript>
    </>
  );
}
