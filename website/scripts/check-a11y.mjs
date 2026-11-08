import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { baseURL, startPreview, stopPreview } from './preview-server.mjs';

const server = await startPreview();
const browser = await chromium.launch();
const paths = ['/km/', '/en/', '/zh/', '/zh/pricing/'];
let serious = 0;

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(`${baseURL}${path}`);
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious');
    serious += violations.length;
    if (violations.length) console.error(`${path}: ${violations.flatMap((item) => item.nodes.map((node) => `${item.id} ${node.target.join(' ')}`)).join(', ')}`);
  }
} finally {
  await browser.close();
  await stopPreview(server);
}

if (serious) {
  console.error(`ACCESSIBILITY_CHECK=FAIL SERIOUS=${serious}`);
  process.exit(1);
}
console.log(`ACCESSIBILITY_CHECK=PASS PAGES=${paths.length}`);
