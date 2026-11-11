import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { baseURL, startPreview, stopPreview } from './preview-server.mjs';

const server = await startPreview();
const browser = await chromium.launch();
const evidence = process.env.EVIDENCE_DIR || path.join(process.cwd(), 'test-results', 'playwright');
const viewports = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];

try {
  for (const lang of ['zh', 'en', 'km']) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      const tracing = page.context().tracing;
      let failed = false;
      await tracing.start({ screenshots: true, snapshots: true, sources: true });
      try {
        await page.goto(`${baseURL}/${lang}/`);
      if (await page.locator('.fullpage-panel').count() !== 6) throw new Error(`${lang}/${viewport.width}: expected six screens`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) throw new Error(`${lang}/${viewport.width}: horizontal overflow`);

      const layouts = await page.locator('.panel-shell').evaluateAll((shells) => shells.map((shell) => {
        const copy = shell.querySelector('.panel-copy').getBoundingClientRect();
        const scene = shell.querySelector('.panel-scene').getBoundingClientRect();
        const horizontalGap = Math.max(copy.left - scene.right, scene.left - copy.right);
        const verticalGap = scene.top - copy.bottom;
        return { horizontalGap, verticalGap };
      }));
      for (const layout of layouts) {
        const gap = viewport.width >= 1024 ? layout.horizontalGap : layout.verticalGap;
        if (gap < 47) throw new Error(`${lang}/${viewport.width}: copy-to-scene gap ${gap.toFixed(1)}px`);
      }

      const headingsClipped = await page.locator('.panel-copy h1, .panel-copy h2').evaluateAll((nodes) => nodes.some((node) => {
        const rect = node.getBoundingClientRect();
        return node.scrollWidth > node.clientWidth + 1 || rect.left < -1 || rect.right > innerWidth + 1;
      }));
      if (headingsClipped) throw new Error(`${lang}/${viewport.width}: heading overflow`);
      const mapFill = await page.locator('.panel-scene-map').evaluate((scene) => {
        const frame = scene.getBoundingClientRect();
        const map = scene.querySelector('svg').getBoundingClientRect();
        return Math.max(Math.abs(frame.width - map.width), Math.abs(frame.height - map.height));
      });
      if (mapFill > 1) throw new Error(`${lang}/${viewport.width}: route map does not fill its card`);

      if (viewport.width >= 1024) {
        const topbar = await page.locator('.fullpage-topbar').evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return { visible: rect.width > 0 && rect.height > 0, height: rect.height, top: rect.top, position: getComputedStyle(node).position };
        });
        if (!topbar.visible || topbar.height > 64 || Math.abs(topbar.top) > 1 || topbar.position !== 'fixed') throw new Error(`${lang}/${viewport.width}: fixed topbar is missing or too tall`);
        if (await page.locator('.fullpage-topbar .topbar-mark:visible').count() !== 1 || await page.locator('.fullpage-topbar .topbar-languages a:visible').count() !== 3 || await page.locator('.fullpage-topbar .topbar-contact:visible').count() !== 1) throw new Error(`${lang}/${viewport.width}: topbar controls are incomplete`);
        if (await page.locator('.fullpage-topbar .topbar-mark').evaluate((node) => node.getBoundingClientRect().width) < 150) throw new Error(`${lang}/${viewport.width}: desktop wordmark is missing`);
        const panels = page.locator('.fullpage-panel');
        for (let index = 0; index < await panels.count(); index += 1) {
          const panel = panels.nth(index);
          await panel.scrollIntoViewIfNeeded();
          const title = panel.locator('.panel-copy h1, .panel-copy h2');
          const metrics = await title.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            return { top: rect.top };
          });
          if (metrics.top < topbar.height + 16) throw new Error(`${lang}/${viewport.width}/screen-${index + 1}: title overlaps topbar clearance`);
        }
        if (viewport.width === 1024) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
          const actionsVisible = await page.locator('#screen-1 .panel-button').evaluateAll((nodes) => nodes.length === 2 && nodes.every((node) => {
            const rect = node.getBoundingClientRect();
            return rect.top >= 64 && rect.bottom <= innerHeight;
          }));
          if (!actionsVisible) throw new Error(`${lang}/1024: first-screen actions are not both visible`);
        }
        const dots = page.locator('.fullpage-dots a');
        if (await dots.count() !== 6) throw new Error(`${lang}/${viewport.width}: incomplete section dots`);
        const unlabeled = await dots.evaluateAll((nodes) => nodes.some((node) => !node.getAttribute('aria-label')));
        if (unlabeled) throw new Error(`${lang}/${viewport.width}: unlabeled section dot`);
      }
      const panelIndexes = await page.locator('.panel-index').allTextContents();
      if (panelIndexes[0].trim() !== '01 / 06' || panelIndexes.slice(1).some((label) => !/^0[2-6] \/ 06 · \S/.test(label.trim()))) throw new Error(`${lang}/${viewport.width}: panel labels do not follow the approved format`);
      } catch (error) {
        failed = true;
        await fs.mkdir(evidence, { recursive: true });
        const label = `${lang}-${viewport.width}`;
        await page.screenshot({ path: path.join(evidence, `${label}-failure.png`), fullPage: true });
        await tracing.stop({ path: path.join(evidence, `${label}-trace.zip`) });
        throw error;
      } finally {
        if (!failed) await tracing.stop();
        await page.close();
      }
    }
  }

  const keyboard = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await keyboard.goto(`${baseURL}/zh/`);
  await keyboard.keyboard.press('PageDown');
  await keyboard.waitForFunction(() => document.querySelector('.fullpage-dots a:nth-child(2)')?.getAttribute('aria-current') === 'step');
  await keyboard.keyboard.press('ArrowDown');
  await keyboard.waitForFunction(() => document.querySelector('.fullpage-dots a:nth-child(3)')?.getAttribute('aria-current') === 'step');
  await keyboard.close();

  const english = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await english.goto(`${baseURL}/en/`);
  const englishFinalTitle = await english.locator('#screen-6-title .title-line').evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()).join(' '));
  if (englishFinalTitle !== "Let's deliver your next order together") throw new Error('en: final screen title is not approved');
  await english.close();

  const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await reduced.goto(`${baseURL}/en/`);
  const reducedResult = await reduced.evaluate(() => ({
    snap: getComputedStyle(document.documentElement).scrollSnapType,
    hidden: [...document.querySelectorAll('[data-motion]')].some((node) => getComputedStyle(node).opacity !== '1'),
  }));
  if (reducedResult.snap !== 'none' || reducedResult.hidden) throw new Error('reduced motion does not disable snap and reveals');
  await reduced.close();

  console.log('FULLPAGE_CHECK=PASS LANGUAGES=3 VIEWPORTS=4 SCREENS=6 KEYBOARD=PASS REDUCED_MOTION=PASS');
} finally {
  await browser.close();
  await stopPreview(server);
}
