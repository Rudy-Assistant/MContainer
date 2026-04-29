// Visual + functional check of FaceFilterWidget.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERR:', err.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
await page.waitForTimeout(2500);

await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((cid) => s.removeContainer?.(cid));
  if (s.wizardOpen) s.closeWizard();
  window.__store.getState().placeModelHome('walkthrough_2_stacked_rooftop', [0, 0, 0]);
  if (window.__store.getState().wizardOpen) window.__store.getState().closeWizard();
});
await page.waitForTimeout(3000);

// Frame the building.
await page.mouse.move(900, 500);
await page.mouse.down();
await page.mouse.move(800, 360, { steps: 25 });
await page.mouse.up();
await page.waitForTimeout(1000);
await page.mouse.wheel(0, -800);
await page.waitForTimeout(1500);

// Initial state — filter is 'all'.
console.log('filter:', await page.evaluate(() => window.__store.getState().faceFilter));
await page.screenshot({ path: `${DIR}/face-filter-all.png`, timeout: 45000 });

// Click the widget's top face (Roof) — that polygon is a triangle around (48, 24) in widget coords.
// Widget is bottom-left absolute, sized 96x80 — so screen coords ~ (16+48, viewport.height - 16 - 80 + 24)
// viewport height = 900, so y = 900 - 16 - 80 + 24 = 828. Click roughly there.
await page.mouse.click(64, 828);
await page.waitForTimeout(500);
console.log('after-roof-click filter:', await page.evaluate(() => window.__store.getState().faceFilter));
await page.screenshot({ path: `${DIR}/face-filter-roof.png`, timeout: 45000 });

// Click the Floor chip (below the cube).
await page.mouse.click(40, 890);
await page.waitForTimeout(500);
console.log('after-floor-click filter:', await page.evaluate(() => window.__store.getState().faceFilter));

// Click All to reset.
await page.mouse.click(85, 890);
await page.waitForTimeout(500);
console.log('after-all-click filter:', await page.evaluate(() => window.__store.getState().faceFilter));

await browser.close();
console.log('done');
