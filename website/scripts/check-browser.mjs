import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { baseURL, startPreview, stopPreview } from './preview-server.mjs';

const server = await startPreview();
const browser = await chromium.launch();
const evidence = process.env.EVIDENCE_DIR || path.resolve('evidence');
await mkdir(evidence, { recursive: true });

try {
  for (const [lang, expected] of [['km', 'km'], ['en', 'en'], ['zh', 'zh']]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseURL}/${lang}/`);
    if (await page.locator('html').getAttribute('lang') !== expected) throw new Error(`${lang}: wrong html lang`);
    const hreflangs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('hreflang')));
    for (const required of ['km', 'en', 'zh', 'x-default']) if (!hreflangs.includes(required)) throw new Error(`${lang}: missing hreflang ${required}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`${lang}: horizontal overflow at 390px`);
    if (lang === 'km') {
      const clipped = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,p,a')].some((node) => node.scrollHeight > node.clientHeight + 2));
      if (clipped) throw new Error('km: clipped copy');
      await page.screenshot({ path: path.join(evidence, 'home-km-390.png'), fullPage: true });
    }
    await page.close();
  }

  const wide = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await wide.goto(`${baseURL}/zh/`);
  if (await wide.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error('zh: horizontal overflow at 1440px');
  await wide.screenshot({ path: path.join(evidence, 'home-zh-1440.png'), fullPage: true });
  await wide.goto(`${baseURL}/zh/pricing/`);
  await wide.locator('a.language-link[lang="en"]').first().click();
  await wide.waitForURL('**/en/pricing/');

  const redirect = await browser.newPage();
  await redirect.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'en-US' }));
  await redirect.goto(`${baseURL}/`);
  await redirect.waitForURL('**/en/');
  await redirect.evaluate(() => localStorage.setItem('routefit-language', 'zh'));
  await redirect.goto(`${baseURL}/`);
  await redirect.waitForURL('**/zh/');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${baseURL}/zh/`);
  await mobile.locator('.mobile-menu > summary').focus();
  await mobile.keyboard.press('Enter');
  if (!(await mobile.locator('.mobile-menu').getAttribute('open') !== null)) throw new Error('mobile menu is not keyboard operable');

  console.log('BROWSER_CHECK=PASS LANGUAGES=3 VIEWPORTS=2');
} finally {
  await browser.close();
  await stopPreview(server);
}
