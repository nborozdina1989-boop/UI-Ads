'use client';

import Script from 'next/script';
import { useEffect } from 'react';

const YM_ID = 104116302; // твой ID

export default function YandexMetrika() {
  // Отправка SPA-хитов без next/navigation, чтобы не требовать <Suspense> на страницах
  useEffect(() => {
    const sendHit = () => {
      try {
        // @ts-ignore
        if (typeof window !== 'undefined' && typeof window.ym === 'function') {
          // @ts-ignore
          window.ym(YM_ID, 'hit', location.pathname + location.search);
        }
      } catch {}
    };

    // initial
    sendHit();

    // перехватываем изменения history
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    const onChange = () => setTimeout(sendHit, 0);

    // @ts-ignore
    history.pushState = function (...args) {
      const ret = origPush.apply(this, args as any);
      onChange();
      return ret;
    } as any;

    // @ts-ignore
    history.replaceState = function (...args) {
      const ret = origReplace.apply(this, args as any);
      onChange();
      return ret;
    } as any;

    window.addEventListener('popstate', onChange);

    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener('popstate', onChange);
    };
  }, []);

  return (
    <>
      {/* Загрузчик тега (с защитой от дубликата) */}
      <Script id="ym-loader" strategy="afterInteractive">
        {`(function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < e.scripts.length; j++) { if (e.scripts[j].src === r) { return; } }
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })(window, document,'script','https://mc.webvisor.org/metrika/tag_ww.js?id=${YM_ID}', 'ym');`}
      </Script>

      {/* Инициализация */}
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
