import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { baseURL, startPreview, stopPreview } from './preview-server.mjs';

const server = await startPreview();
const browser = await chromium.launch();
const evidence = process.env.EVIDENCE_DIR || path.join(os.tmpdir(), 'routefit-website-evidence');
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
    }
    await page.screenshot({ path: path.join(evidence, `website-${lang}-home-390.png`), fullPage: true });
    await page.goto(`${baseURL}/${lang}/pricing/`);
    await page.screenshot({ path: path.join(evidence, `website-${lang}-pricing-390.png`), fullPage: true });
    await page.close();
  }

  const wide = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const lang of ['km', 'en', 'zh']) {
    await wide.goto(`${baseURL}/${lang}/`);
    await wide.screenshot({ path: path.join(evidence, `website-${lang}-home-1440.png`), fullPage: true });
    await wide.goto(`${baseURL}/${lang}/pricing/`);
    await wide.screenshot({ path: path.join(evidence, `website-${lang}-pricing-1440.png`), fullPage: true });
  }
  await wide.goto(`${baseURL}/zh/`);
  if (await wide.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error('zh: horizontal overflow at 1440px');
  for (const [selector, label] of [['.route-track span:nth-child(2)', 'route midpoint'], ['.route-step-4 > span', 'handoff node']]) {
    const background = await wide.locator(selector).evaluate((node) => getComputedStyle(node).backgroundColor);
    if (background === 'transparent' || background === 'rgba(0, 0, 0, 0)') throw new Error(`zh: ${label} background is transparent`);
  }
  const navigation = await wide.locator('.desktop-nav > *').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()));
  if (JSON.stringify(navigation) !== JSON.stringify(['服务', '价格说明', '司机与车队', '查单', '关于我们', '帮助中心'])) throw new Error('zh: navigation does not match approved design');
  if (await wide.locator('.desktop-nav .nav-disabled[aria-disabled="true"]').textContent() !== '查单') throw new Error('zh: track navigation is not visibly unavailable');
  const pageText = await wide.locator('body').textContent();
  for (const fact of ['金边及周边', '确认报价后先付款', '企业客户按月结算', '系统会重新报价', '基础货损保障', '商业保险']) {
    if (!pageText?.includes(fact)) throw new Error(`zh: missing approved fact: ${fact}`);
  }
  const paymentFaq = wide.locator('.faq-list details').filter({ hasText: '什么时候付款？' });
  await paymentFaq.locator('summary').click();
  if (!(await paymentFaq.locator('p').isVisible())) throw new Error('zh: payment FAQ answer is not visible after click');
  if (!(await paymentFaq.locator('p').innerText()).includes('确认报价后先付款')) throw new Error('zh: payment FAQ answer does not contain approved copy');
  if (!(await wide.locator('meta[property="og:image"]').getAttribute('content'))?.endsWith('/og-card.png')) throw new Error('zh: social image is not PNG');
  if (await wide.locator('meta[property="og:image:width"]').getAttribute('content') !== '1200') throw new Error('zh: wrong social image width');
  if (await wide.locator('meta[property="og:image:height"]').getAttribute('content') !== '630') throw new Error('zh: wrong social image height');
  await wide.goto(`${baseURL}/zh/pricing/`);
  for (const fact of ['报价费用逐项列明', '确认报价后才收费', '每份报价都有有效期']) {
    if (!(await wide.locator('body').textContent())?.includes(fact)) throw new Error(`zh pricing: missing approved fact: ${fact}`);
  }
  if (/\$|USD|KHR|美元|瑞尔/.test((await wide.locator('.pricing-facts').textContent()) ?? '')) throw new Error('zh pricing: contains an unapproved price');
  await wide.locator('a.language-link[lang="en"]').first().click();
  await wide.waitForURL('**/en/pricing/');

  const redirect = await browser.newPage();
  await redirect.addInitScript(() => Object.defineProperty(navigator, 'language', { get: () => 'en-US' }));
  await redirect.goto(`${baseURL}/`);
  await redirect.waitForURL('**/en/');
  await redirect.evaluate(() => localStorage.setItem('routefit-language', 'zh'));
  await redirect.goto(`${baseURL}/`);
  await redirect.waitForURL('**/zh/');

  const blockedStorage = await browser.newPage();
  await blockedStorage.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage blocked'); };
    Storage.prototype.setItem = () => { throw new Error('storage blocked'); };
    Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
  });
  await blockedStorage.goto(`${baseURL}/`);
  await blockedStorage.waitForURL('**/en/');
  await blockedStorage.locator('a.language-link[lang="zh"]').first().click();
  await blockedStorage.waitForURL('**/zh/');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${baseURL}/zh/`);
  await mobile.locator('.mobile-menu > summary').focus();
  await mobile.keyboard.press('Enter');
  if (!(await mobile.locator('.mobile-menu').getAttribute('open') !== null)) throw new Error('mobile menu is not keyboard operable');

  const sitemap = await (await wide.request.get(`${baseURL}/sitemap.xml`)).text();
  const sitemapUrls = [...sitemap.matchAll(/<loc>/g)].length;
  if (sitemapUrls !== 3 || sitemap.includes('/pricing/')) throw new Error('sitemap includes unavailable pages');

  console.log('BROWSER_CHECK=PASS LANGUAGES=3 VIEWPORTS=2 SITEMAP_URLS=3 STORAGE_FAILURES=2');
} finally {
  await browser.close();
  await stopPreview(server);
}
