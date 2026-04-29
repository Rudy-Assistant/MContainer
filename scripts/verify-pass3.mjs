// Visual confirm of pass 3: SVG wizard icons + softened shadows + refactored modals.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots/pass-3';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERR:', err.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
await page.waitForTimeout(2500);

// Open the wizard fresh — see the new SVG preset icons.
await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((cid) => s.removeContainer?.(cid));
  if (!window.__store.getState().wizardOpen) window.__store.getState().openWizard();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${DIR}/wizard-svg-icons.png`, timeout: 45000 });
console.log('wizard-svg-icons.png');

// Pick a glass preset to surface the steps panel + softened shadows under the
// rendered scene behind the modal.
await page.evaluate(() => {
  window.__store.getState().setWizardPresetId('glass_atrium_home');
});
await page.waitForTimeout(700);
await page.screenshot({ path: `${DIR}/wizard-svg-icons-selected.png`, timeout: 45000 });
console.log('wizard-svg-icons-selected.png');

// Close + place a model home so we can see ground shadows.
await page.evaluate(() => {
  window.__store.getState().closeWizard();
  window.__store.getState().placeModelHome('walkthrough_2_stacked_rooftop', [0, 0, 0]);
});
await page.waitForTimeout(3000);
// Frame
await page.mouse.move(900, 500);
await page.mouse.down();
await page.mouse.move(820, 380, { steps: 25 });
await page.mouse.up();
await page.waitForTimeout(1000);
await page.mouse.wheel(0, -1000);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${DIR}/scene-soft-shadows.png`, timeout: 45000 });
console.log('scene-soft-shadows.png');

await browser.close();
console.log('done');
