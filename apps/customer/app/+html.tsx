import { PropsWithChildren } from 'react';
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  const { bodyAttributes, bodyNodes, headNodes, htmlAttributes } = useServerDocumentContext();

  return (
    <html lang="km" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
        <link href="/fonts/ibm-plex-sans/index.css" rel="stylesheet" />
        <link href="/fonts/noto-sans-sc/index.css" rel="stylesheet" />
        <link href="/fonts/noto-sans-khmer/index.css" rel="stylesheet" />
        <ScrollViewStyleReset />
        <style>{`
          :root { color-scheme: light; scrollbar-color: #8796A6 #D9E1E8; scrollbar-width: thin; }
          * { box-sizing: border-box; }
          html, body, #root { min-height: 100%; margin: 0; background: #F3F5F7; }
          body { font-family: "IBM Plex Sans", "Noto Sans SC", "Noto Sans Khmer", sans-serif; }
          *::-webkit-scrollbar { width: 10px; height: 10px; }
          *::-webkit-scrollbar-track { background: #D9E1E8; }
          *::-webkit-scrollbar-thumb { background: #8796A6; border: 2px solid #D9E1E8; border-radius: 999px; }
          *::-webkit-scrollbar-thumb:hover { background: #59697A; }
          #routefit-app-shell {
            padding-top: max(env(safe-area-inset-top), var(--tg-safe-area-inset-top, 0px));
            padding-right: max(env(safe-area-inset-right), var(--tg-safe-area-inset-right, 0px));
            padding-bottom: max(env(safe-area-inset-bottom), var(--tg-safe-area-inset-bottom, 0px));
            padding-left: max(env(safe-area-inset-left), var(--tg-safe-area-inset-left, 0px));
          }
          button:focus-visible, [role="button"]:focus-visible, [role="tab"]:focus-visible, a:focus-visible {
            outline: 3px solid #13C29B; outline-offset: 3px;
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
