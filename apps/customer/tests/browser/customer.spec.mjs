import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const evidenceDirectory = process.env.ROUTEFIT_EVIDENCE_DIRECTORY;

test.beforeAll(() => {
  if (!evidenceDirectory) throw new Error('ROUTEFIT_EVIDENCE_DIRECTORY is required');
  fs.mkdirSync(evidenceDirectory, { recursive: true });
});

test('H5 mode supports three languages and all four tabs', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Storage is blocked', 'SecurityError'); },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('runtime-mode')).toContainText('H5');
  await expect(page.getByText('ការផ្ញើនឹងមកដល់ឆាប់ៗ')).toBeVisible();

  await page.getByTestId('language-en').click();
  await expect(page.getByText('Sending is coming soon')).toBeVisible();
  const tabTitles = {
    orders: 'Your orders will appear here',
    messages: 'Messages are coming soon',
    profile: 'Account settings are coming soon',
    send: 'Sending is coming soon',
  };
  for (const [tab, title] of Object.entries(tabTitles)) {
    await page.getByTestId(`tab-${tab}`).click();
    await expect(page.getByTestId(`tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(title)).toBeVisible();
  }

  await page.getByTestId('language-zh').click();
  await expect(page.getByText('寄件功能即将开放')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ fullPage: true, path: path.join(evidenceDirectory, 'batch1-h5-390.png') });

  await page.getByTestId('track-link').click();
  await expect(page).toHaveURL(/\/track$/);
  await expect(page.getByText('查件功能即将开放')).toBeVisible();
});

test('mocked Telegram mode calls ready and expand', async ({ page }) => {
  await page.addInitScript(() => {
    window.__telegramCalls = [];
    window.Telegram = { WebApp: {
      ready: () => window.__telegramCalls.push('ready'),
      expand: () => window.__telegramCalls.push('expand'),
      themeParams: { bg_color: '#F6F8FB', text_color: '#0B2545' },
      safeAreaInset: { top: 0, right: 0, bottom: 0, left: 0 },
      BackButton: {
        hide: () => window.__telegramCalls.push('back:hide'),
        offClick() {},
        onClick() {},
        show: () => window.__telegramCalls.push('back:show'),
      },
    } };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect.poll(() => page.evaluate(() => window.__telegramCalls)).toEqual(['ready', 'expand']);
  await expect(page.getByTestId('runtime-mode')).toContainText('Mini App');
  await expect(page.locator('script[data-routefit-telegram="official"]')).toHaveCount(0);
  await page.screenshot({ fullPage: true, path: path.join(evidenceDirectory, 'batch1-mini-app-1440.png') });
  await page.getByTestId('track-link').click();
  await expect.poll(() => page.evaluate(() => window.__telegramCalls.includes('back:show'))).toBe(true);
});
