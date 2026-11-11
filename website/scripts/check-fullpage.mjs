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
const snapViewports = [
  { width: 1920, height: 1000 },
  ...viewports.filter(({ width, height }) => width >= 1024 && height >= 820),
];
const trifoldViewports = [
  { label: 'single-portrait', width: 390, height: 840, snap: false },
  { label: 'single-landscape', width: 840, height: 390, snap: false },
  { label: 'dual-portrait', width: 750, height: 840, snap: false },
  { label: 'dual-landscape', width: 840, height: 750, snap: false },
  { label: 'triple-portrait', width: 780, height: 1100, snap: false },
  { label: 'triple-landscape', width: 1100, height: 780, snap: false },
  { label: 'extreme-portrait', width: 700, height: 1100, snap: false },
  { label: 'extreme-landscape', width: 1100, height: 700, snap: false },
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
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
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
        const gap = viewport.width >= 1024 && viewport.height >= 820 ? layout.horizontalGap : layout.verticalGap;
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
          await panel.evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'auto' }));
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

  for (const lang of ['zh', 'en', 'km']) {
    for (const viewport of snapViewports) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseURL}/${lang}/`);
      await page.evaluate(() => window.scrollTo(0, 0));
      for (let index = 0; index < 6; index += 1) {
        if (index > 0) await page.keyboard.press('PageDown');
        await page.waitForFunction((panelIndex) => {
          const panel = document.querySelectorAll('.fullpage-panel')[panelIndex];
          return panel && Math.abs(panel.getBoundingClientRect().top) <= 1;
        }, index);
        const position = await page.evaluate((panelIndex) => {
          const panels = [...document.querySelectorAll('.fullpage-panel')];
          return {
            top: panels[panelIndex].getBoundingClientRect().top,
            previousBottom: panelIndex === 0 ? 0 : panels[panelIndex - 1].getBoundingClientRect().bottom,
          };
        }, index);
        if (Math.abs(position.top) > 1 || position.previousBottom > 1) {
          throw new Error(`${lang}/${viewport.width}/screen-${index + 1}: previous screen remains visible after snap`);
        }
      }
      await page.keyboard.press('End');
      await page.waitForFunction(() => {
        const footer = document.querySelector('.site-footer')?.getBoundingClientRect();
        return footer && footer.top >= -1 && footer.bottom <= innerHeight + 1;
      });
      const footer = page.locator('.site-footer');
      const footerBounds = await footer.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, viewport: innerHeight };
      });
      if (footerBounds.top < -1 || footerBounds.bottom > footerBounds.viewport + 1) {
        throw new Error(`${lang}/${viewport.width}: footer is not fully visible`);
      }
      await page.locator(`.site-footer a[href="/${lang}/terms/"]`).click({ trial: true });
      await page.locator(`.site-footer a[href="/${lang}/privacy/"]`).click({ trial: true });
      await page.close();
    }
  }

  for (const lang of ['zh', 'en', 'km']) {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(`${baseURL}/${lang}/`);
    const mobileSnap = await mobile.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);
    if (mobileSnap !== 'none') throw new Error(`${lang}/390: mobile scroll snap changed`);
    await mobile.close();
  }

  for (const lang of ['zh', 'en', 'km']) {
    for (const viewport of trifoldViewports) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseURL}/${lang}/`);
      await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
      const snap = await page.evaluate(() => getComputedStyle(document.documentElement).scrollSnapType);
      if ((snap !== 'none') !== viewport.snap) throw new Error(`${lang}/${viewport.label}: unexpected snap mode ${snap}`);
      const panels = page.locator('.fullpage-panel');
      for (let index = 0; index < await panels.count(); index += 1) {
        const panel = panels.nth(index);
        await panel.evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'auto' }));
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const clipped = await panel.evaluate((node, snapEnabled) => {
          const panelRect = node.getBoundingClientRect();
          const content = [...node.querySelectorAll('.panel-copy h1, .panel-copy h2, .panel-copy p, .panel-copy li, .panel-copy a')]
            .filter((item) => item.getBoundingClientRect().width > 0 && item.getBoundingClientRect().height > 0);
          const item = content.find((candidate) => {
            const rect = candidate.getBoundingClientRect();
            return rect.left < -1 || rect.right > innerWidth + 1 || rect.top < panelRect.top - 1 || rect.bottom > panelRect.bottom + 1
              || (snapEnabled && (rect.top < -1 || rect.bottom > innerHeight + 1));
          });
          if (!item) return null;
          const rect = item.getBoundingClientRect();
          return {
            tag: item.tagName,
            text: item.textContent?.trim().slice(0, 40),
            rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
            panel: { top: panelRect.top, bottom: panelRect.bottom },
            viewport: { width: innerWidth, height: innerHeight },
          };
        }, viewport.snap);
        if (clipped) throw new Error(`${lang}/${viewport.label}/screen-${index + 1}: copy or action is clipped ${JSON.stringify(clipped)}`);
        if (viewport.snap) {
          const position = await page.evaluate((panelIndex) => {
            const all = document.querySelectorAll('.fullpage-panel');
            return {
              top: all[panelIndex].getBoundingClientRect().top,
              previousBottom: panelIndex === 0 ? 0 : all[panelIndex - 1].getBoundingClientRect().bottom,
            };
          }, index);
          if (Math.abs(position.top) > 1 || position.previousBottom > 1) throw new Error(`${lang}/${viewport.label}/screen-${index + 1}: previous screen remains visible`);
        }
      }
      await page.keyboard.press('End');
      await page.waitForFunction(() => Math.abs(document.documentElement.scrollHeight - innerHeight - scrollY) <= 1);
      await page.locator(`.site-footer a[href="/${lang}/terms/"]`).click({ trial: true });
      await page.locator(`.site-footer a[href="/${lang}/privacy/"]`).click({ trial: true });
      await page.close();
    }
  }

  for (const lang of ['zh', 'en', 'km']) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
    await page.goto(`${baseURL}/${lang}/`);
    await page.locator('#screen-3').evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'auto' }));
    await page.waitForFunction(() => document.querySelector('.fullpage-dots a:nth-child(3)')?.getAttribute('aria-current') === 'step');
    for (const size of [{ width: 390, height: 840 }, { width: 750, height: 840 }, { width: 1100, height: 780 }, { width: 390, height: 840 }, { width: 1100, height: 780 }]) {
      await page.setViewportSize(size);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const layout = await page.locator('#screen-3').evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const center = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        return { intersects: rect.top < innerHeight && rect.bottom > 0, blank: !center?.closest('.fullpage-panel, .site-footer') };
      });
      if (!layout.intersects || layout.blank) throw new Error(`${lang}/${size.width}x${size.height}: resize lost the current screen or exposed blank space`);
    }
    await page.close();
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

  console.log('FULLPAGE_CHECK=PASS LANGUAGES=3 VIEWPORTS=4 SCREENS=6 KEYBOARD=PASS FOOTER=PASS REDUCED_MOTION=PASS TRIFOLD=PASS TRIFOLD_STATES=8 RESIZE=PASS');
} finally {
  await browser.close();
  await stopPreview(server);
}
