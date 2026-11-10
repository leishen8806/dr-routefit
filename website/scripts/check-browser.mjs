import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { baseURL, startPreview, stopPreview } from './preview-server.mjs';

const server = await startPreview();
const browser = await chromium.launch();
const evidence = process.env.EVIDENCE_DIR || path.join(os.tmpdir(), 'routefit-website-evidence');
await mkdir(evidence, { recursive: true });
const slogans = {
  km: 'ការដឹកជញ្ជូនចម្ងាយចុងក្រោយនៅកម្ពុជា ដល់ដៃអ្នកទទួលផ្ទាល់',
  en: "Cambodia's last mile, delivered to the right hands",
  zh: '柬埔寨最后一公里，直达收件人',
};

try {
  for (const [lang, expected] of [['km', 'km'], ['en', 'en'], ['zh', 'zh']]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseURL}/${lang}/`);
    if (await page.locator('html').getAttribute('lang') !== expected) throw new Error(`${lang}: wrong html lang`);
    const hreflangs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('hreflang')));
    for (const required of ['km', 'en', 'zh', 'x-default']) if (!hreflangs.includes(required)) throw new Error(`${lang}: missing hreflang ${required}`);
    const xDefault = await page.locator('link[rel="alternate"][hreflang="x-default"]').getAttribute('href');
    if (!xDefault || new URL(xDefault).pathname !== '/en/') throw new Error(`${lang}: x-default does not point to English`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error(`${lang}: horizontal overflow at 390px`);
    const headingFailure = await page.locator('.section-heading h2').evaluateAll((nodes) => nodes.some((node) => {
      const rect = node.getBoundingClientRect();
      return node.scrollWidth > node.clientWidth + 1 || rect.left < -1 || rect.right > innerWidth + 1;
    }));
    if (headingFailure) throw new Error(`${lang}: section heading overflows or is clipped at 390px`);
    if (await page.getByText(slogans[lang], { exact: true }).count() !== 1) throw new Error(`${lang}: slogan must appear exactly once`);
    const mapRect = await page.locator('.coverage-map').evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, label: node.getAttribute('aria-label') };
    });
    if (mapRect.left < -1 || mapRect.right > 391 || !mapRect.label) throw new Error(`${lang}: coverage map overflows or lacks an accessible label`);
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
  const valueHeading = wide.locator('.section-heading h2').filter({ hasText: '把三件事做对：车、路线、时间' });
  const valueHeadingMetrics = await valueHeading.evaluate((node) => {
    const lineHeight = Number.parseFloat(getComputedStyle(node).lineHeight);
    return { height: node.getBoundingClientRect().height, lineHeight };
  });
  if (valueHeadingMetrics.height > valueHeadingMetrics.lineHeight + 1) throw new Error('zh: value section heading wraps at 1440px');
  const labelBottoms = await wide.locator('.route-step strong').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().bottom));
  if (Math.max(...labelBottoms) - Math.min(...labelBottoms) > 2) throw new Error('zh: route labels do not share a baseline');
  if (/\bDR\b/.test(await wide.locator('.coverage-map').innerText())) throw new Error('zh: coverage map still shows the DR circle label');
  if (await wide.locator('.route-mark').count() !== 1 || await wide.locator('.coverage-route-mark').count() !== 1) throw new Error('zh: route mark is missing');
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

  for (const [locale, expected] of [['zh-CN', 'zh'], ['km-KH', 'km'], ['th-TH', 'en'], ['en-US', 'en']]) {
    const context = await browser.newContext({ locale });
    const redirect = await context.newPage();
    await redirect.goto(`${baseURL}/?source=locale#proof`);
    await redirect.waitForURL((url) => url.pathname === `/${expected}/` && url.search === '?source=locale' && url.hash === '#proof');
    await context.close();
  }

  const savedContext = await browser.newContext({ locale: 'km-KH' });
  const savedRedirect = await savedContext.newPage();
  await savedRedirect.goto(`${baseURL}/en/`);
  await savedRedirect.evaluate(() => localStorage.setItem('routefit-language', 'zh'));
  await savedRedirect.goto(`${baseURL}/?source=saved#handoff`);
  await savedRedirect.waitForURL((url) => url.pathname === '/zh/' && url.search === '?source=saved' && url.hash === '#handoff');
  await savedContext.close();

  const blockedContext = await browser.newContext({ locale: 'km-KH' });
  const blockedStorage = await blockedContext.newPage();
  const storageErrors = [];
  blockedStorage.on('pageerror', (error) => storageErrors.push(error.message));
  await blockedStorage.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage blocked'); };
    Storage.prototype.setItem = () => { throw new Error('storage blocked'); };
  });
  await blockedStorage.goto(`${baseURL}/`);
  await blockedStorage.waitForURL('**/km/');
  if (storageErrors.length) throw new Error(`storage blocked: ${storageErrors.join(', ')}`);
  await blockedStorage.locator('a.language-link[lang="zh"]').first().click();
  await blockedStorage.waitForURL('**/zh/');
  await blockedContext.close();

  const transitionContext = await browser.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 } });
  const transition = await transitionContext.newPage();
  await transition.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== baseURL || url.pathname !== '/') return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': "script-src 'none'" },
    });
  });
  await transition.goto(`${baseURL}/`);
  if (await transition.locator('html').getAttribute('lang') !== 'en') throw new Error('root: wrong html lang');
  if (/(ខ្មែរ|English|中文)/.test(await transition.locator('body').innerText())) throw new Error('root: language links flashed during redirect');
  await transition.screenshot({ path: path.join(evidence, 'website-root-redirect-transition.png') });
  await transitionContext.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${baseURL}/zh/`);
  await mobile.locator('.mobile-menu > summary').focus();
  await mobile.keyboard.press('Enter');
  if (!(await mobile.locator('.mobile-menu').getAttribute('open') !== null)) throw new Error('mobile menu is not keyboard operable');

  const sitemap = await (await wide.request.get(`${baseURL}/sitemap.xml`)).text();
  const sitemapUrls = [...sitemap.matchAll(/<loc>/g)].length;
  if (sitemapUrls !== 3 || sitemap.includes('/pricing/')) throw new Error('sitemap includes unavailable pages');

  console.log('BROWSER_CHECK=PASS LANGUAGES=3 ROOT_LOCALES=4 VIEWPORTS=2 SITEMAP_URLS=3 STORAGE_FAILURES=2');
} finally {
  await browser.close();
  await stopPreview(server);
}
