import { PropsWithChildren } from 'react';
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';

export default function Root({ children }: PropsWithChildren) {
  const { bodyAttributes, bodyNodes, headNodes, htmlAttributes } = useServerDocumentContext();
  return <html lang="zh-CN" {...htmlAttributes}><head><meta charSet="utf-8" /><meta content="width=device-width, initial-scale=1, viewport-fit=cover" name="viewport" />
    <link href="/fonts/ibm-plex-sans/index.css" rel="stylesheet" /><link href="/fonts/noto-sans-sc/index.css" rel="stylesheet" /><link href="/fonts/noto-sans-khmer/index.css" rel="stylesheet" />
    <ScrollViewStyleReset /><style>{`html,body,#root{min-height:100%;margin:0;background:#F3F5F7}body{font-family:"IBM Plex Sans","Noto Sans SC","Noto Sans Khmer",sans-serif}:lang(km){font-family:"Noto Sans Khmer",sans-serif;line-height:1.85}*{box-sizing:border-box}@media (prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;transition-duration:.01ms!important}}`}</style>{headNodes}
  </head><body {...bodyAttributes}>{children}{bodyNodes}</body></html>;
}
