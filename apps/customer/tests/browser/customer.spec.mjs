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
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('customer-home-runtime-mode')).toContainText('H5');
  await expect(page.getByTestId('customer-home-brand-mark')).toBeVisible();
  await expect(page.getByTestId('customer-home-brand-mark').locator('path')).toHaveAttribute('d', 'M16 53 V13 A4 4 0 0 1 20 9 H38 A13 13 0 0 1 51 22 A13 13 0 0 1 38 35 H26 L44 53');
  await expect(page.getByText('ការផ្ញើនឹងមកដល់ឆាប់ៗ')).toBeVisible();
  await expect(page.getByTestId('customer-home-route-diagram')).toHaveCount(1);
  await expect(page.getByTestId('customer-home-startup-ad')).toBeVisible();
  await expect(page.getByTestId('customer-home-startup-ad-card')).toBeVisible();
  await expect(page.getByTestId('customer-home-startup-ad')).toHaveCSS('background-color', 'rgba(11, 37, 69, 0.42)');
  await page.getByTestId('customer-home-startup-ad-dismiss').click();
  await expect(page.getByTestId('customer-home-promotion')).toBeVisible();
  await expect(page.getByTestId('customer-home-promotion-card')).toBeVisible();
  await expect(page.getByTestId('customer-home-promotion')).toHaveCSS('background-color', 'rgba(11, 37, 69, 0.42)');
  await page.getByTestId('customer-home-promotion-dismiss').click();

  for (const tab of ['send', 'orders', 'messages', 'profile']) {
    await page.getByTestId(`customer-home-tab-${tab}`).click();
    await page.getByTestId('customer-home-content-panel').scrollIntoViewIfNeeded();
    await page.screenshot({ fullPage: true, path: path.join(evidenceDirectory, `customer-h5-${tab}.png`) });
  }

  await page.getByTestId('customer-home-tab-send').click();
  await page.getByTestId('customer-home-language-en').click();
  await expect(page.getByLabel('Pickup location')).toBeVisible();
  await expect(page.getByLabel('Recipient')).toBeVisible();
  await expect(page.getByLabel('Destination')).toBeVisible();
  await expect(page.getByLabel('Item')).toBeVisible();
  await expect(page.getByLabel('Vehicle')).toBeVisible();
  await expect(page.getByTestId('customer-send-pickup')).toBeVisible();
  await expect(page.getByTestId('customer-send-recipient')).toBeVisible();
  await expect(page.getByTestId('customer-send-destination')).toBeVisible();
  await expect(page.getByTestId('customer-send-item')).toBeVisible();
  await expect(page.getByTestId('customer-send-vehicle')).toBeVisible();
  await page.getByTestId('customer-send-bulk-select').click();
  await page.getByTestId('customer-send-pickup').fill('Example pickup');
  await page.getByTestId('customer-send-recipient').fill('Example recipient');
  await page.getByTestId('customer-send-destination').fill('Example destination');
  await page.getByTestId('customer-send-item').fill('Example parcel');
  await page.getByTestId('customer-send-vehicle').fill('Example vehicle');
  await page.getByTestId('customer-send-cod-declare').click();
  await page.getByTestId('customer-ship-submit').click();
  await expect(page.getByTestId('customer-send-quote')).toContainText('8.5000 USD');
  await expect(page.getByTestId('customer-send-quote')).toContainText('Example vehicle');
  await page.getByTestId('customer-quote-confirm').click();
  await expect(page.getByTestId('customer-payment-confirmation')).toBeVisible();
  await page.getByTestId('customer-payment-cancel').click();
  await expect(page.getByTestId('customer-payment-confirmation')).toHaveCount(0);
  await page.getByTestId('customer-pay-confirm').click();
  await expect(page.getByTestId('customer-payment-confirmation')).toBeVisible();
  await page.getByTestId('customer-payment-cancel').click();
  await expect(page.getByTestId('customer-payment-confirmation')).toHaveCount(0);
  const tabContent = {
    orders: page.getByTestId('customer-orders-example-detail'),
    messages: page.getByTestId('customer-messages-example'),
    profile: page.getByTestId('customer-profile-example'),
    send: page.getByTestId('customer-send-pickup'),
  };
  for (const [tab, content] of Object.entries(tabContent)) {
    await page.getByTestId(`customer-home-tab-${tab}`).click();
    await expect(page.getByTestId(`customer-home-tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
    await expect(content).toBeVisible();
  }

  await page.getByTestId('customer-home-tab-orders').click();
  await expect(page.getByTestId('customer-orders-example-EXAMPLE-CUSTOMER-001')).toContainText('EXAMPLE-CUSTOMER-001');
  await page.getByTestId('customer-home-tab-messages').click();
  await expect(page.getByTestId('customer-messages-example')).toContainText('A driver has been assigned to your example order.');

  await page.getByTestId('customer-home-language-zh').click();
  await page.getByTestId('customer-home-tab-send').click();
  await expect(page.getByTestId('customer-send-pickup')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ fullPage: true, path: path.join(evidenceDirectory, 'batch1-h5-390.png') });

  await page.getByTestId('customer-home-track-link').click();
  await expect(page).toHaveURL(/\/track$/);
  await expect(page.getByText('查件功能即将开放')).toBeVisible();
});

test('mocked Telegram mode calls ready and expand', async ({ page }) => {
  await page.addInitScript(() => {
    window.__telegramCalls = [];
    window.Telegram = { WebApp: {
      ready: () => window.__telegramCalls.push('ready'),
      expand: () => window.__telegramCalls.push('expand'),
      themeParams: {
        bg_color: '#F3F5F7',
        text_color: '#10243E',
        secondary_bg_color: '#EEF6F4',
        button_color: '#1B8F76',
        button_text_color: '#FFFFFF',
        hint_color: '#59697A',
      },
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
  await page.getByTestId('customer-home-startup-ad-dismiss').click();
  await page.getByTestId('customer-home-promotion-dismiss').click();
  await expect.poll(() => page.evaluate(() => window.__telegramCalls)).toEqual(['ready', 'expand']);
  await expect(page.getByTestId('customer-home-runtime-mode')).toContainText('Mini App');
  await expect(page.getByTestId('customer-home-runtime-mode')).toHaveCSS('background-color', 'rgb(27, 143, 118)');
  await expect(page.locator('script[data-routefit-telegram="official"]')).toHaveCount(0);
  for (const tab of ['send', 'orders', 'messages', 'profile']) {
    await page.getByTestId(`customer-home-tab-${tab}`).click();
    await page.screenshot({ fullPage: true, path: path.join(evidenceDirectory, `customer-telegram-${tab}.png`) });
  }
  await page.getByTestId('customer-home-track-link').click();
  await expect.poll(() => page.evaluate(() => window.__telegramCalls.includes('back:show'))).toBe(true);
});
