import { PropsWithChildren } from 'react';
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  const { bodyAttributes, bodyNodes, headNodes, htmlAttributes } = useServerDocumentContext();

  return (
    <html lang="km" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
        <ScrollViewStyleReset />
        <style>{`
          :root { color-scheme: light; scrollbar-color: #9AA9BA #E3E8EF; scrollbar-width: thin; }
          * { box-sizing: border-box; }
          html, body, #root { min-height: 100%; margin: 0; background: #F6F8FB; }
          body { font-family: Inter, "Noto Sans Khmer", "Noto Sans SC", "Segoe UI", sans-serif; }
          *::-webkit-scrollbar { width: 10px; height: 10px; }
          *::-webkit-scrollbar-track { background: #E3E8EF; }
          *::-webkit-scrollbar-thumb { background: #9AA9BA; border: 2px solid #E3E8EF; border-radius: 999px; }
          *::-webkit-scrollbar-thumb:hover { background: #5B6B7F; }
          #routefit-app-shell {
            padding-top: max(env(safe-area-inset-top), var(--tg-safe-area-inset-top, 0px));
            padding-right: max(env(safe-area-inset-right), var(--tg-safe-area-inset-right, 0px));
            padding-bottom: max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px));
            padding-left: max(env(safe-area-inset-left), var(--tg-safe-area-inset-left, 0px));
          }
          button:focus-visible, [role="button"]:focus-visible, [role="tab"]:focus-visible, a:focus-visible {
            outline: 3px solid #1D5FBF; outline-offset: 3px;
          }
          @media (forced-colors: active) { :root { scrollbar-color: auto; } }
          @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; } }
        `}</style>
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
