'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useEffect } from 'react';

export default function BotpressChat() {
  const pathname = usePathname();

  // No mostrar el bot en la página de carga del profesor (/profe y /profesor)
  const isExcluded = pathname?.startsWith('/profe') || pathname?.startsWith('/profesor');

  useEffect(() => {
    if (isExcluded) {
      // Ocultar cualquier elemento del widget de Botpress si quedó cargado en el DOM
      const hideWidget = () => {
        try {
          if ((window as any).botpress) {
            (window as any).botpress.close?.();
          }
          const widget = document.getElementById('bp-web-widget');
          if (widget) {
            widget.style.display = 'none';
          }
          const allBp = document.querySelectorAll(
            '#bp-web-widget, [class*="bp-widget"], iframe[src*="botpress"], div[id*="bp-"]'
          );
          allBp.forEach((el) => {
            (el as HTMLElement).style.setProperty('display', 'none', 'important');
            (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
          });
        } catch {}
      };

      hideWidget();
      const interval = setInterval(hideWidget, 500);
      const timer = setTimeout(() => clearInterval(interval), 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    } else {
      // Restaurar visibilidad al volver a otra página
      try {
        const allBp = document.querySelectorAll(
          '#bp-web-widget, [class*="bp-widget"], iframe[src*="botpress"], div[id*="bp-"]'
        );
        allBp.forEach((el) => {
          (el as HTMLElement).style.display = '';
          (el as HTMLElement).style.visibility = '';
        });
      } catch {}
    }
  }, [isExcluded]);

  if (isExcluded) {
    return null;
  }

  return (
    <>
      <Script src="https://cdn.botpress.cloud/webchat/v5.0/inject.js" strategy="afterInteractive" />
      <Script src="https://files.bpcontent.cloud/2026/09/22/13/20260922131653-C4YS3AF8.js" strategy="afterInteractive" />
    </>
  );
}
