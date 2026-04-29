// Visual verification of the design overhaul: WizardModal + Inspector sidebar.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots/design-pass-2';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERR:', err.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
await page.waitForTimeout(2500);

// 1. Open the wizard fresh — that's the surface the user complained about.
await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((cid) => s.removeContainer?.(cid));
  if (!window.__store.getState().wizardOpen) window.__store.getState().openWizard();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${DIR}/wizard-modal-rebuilt.png`, timeout: 45000 });
console.log('1: wizard-modal-rebuilt.png');

// 2. Pick a preset to surface the steps panel.
await page.evaluate(() => window.__store.getState().setWizardPresetId('full_glass_home'));
await page.waitForTimeout(800);
await page.screenshot({ path: `${DIR}/wizard-modal-with-steps.png`, timeout: 45000 });
console.log('2: wizard-modal-with-steps.png');

// 3. Close + place a model home + select container to show the Inspector sidebar.
await page.evaluate(() => {
  window.__store.getState().closeWizard();
  window.__store.getState().placeModelHome('walkthrough_1_studio', [0, 0, 0]);
});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const ids = Object.keys(window.__store.getState().containers);
  if (ids[0]) window.__store.getState().select(ids[0]);
});
await page.waitForTimeout(800);
await page.screenshot({ path: `${DIR}/sidebar-inspector.png`, timeout: 45000 });
console.log('3: sidebar-inspector.png');

await browser.close();
console.log('done');
