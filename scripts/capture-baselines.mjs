/**
 * Capture reference baseline PNGs for visual acceptance gates.
 *
 * Run: node scripts/capture-baselines.mjs
 * Prereq: dev server on http://localhost:3000
 *
 * Captures a known-state screenshot for each visual gate scenario.
 * Uses page.evaluate() for initial state setup (acceptable for baseline capture).
 * Uses real UI interactions (clicks, slider) for subsequent captures.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3000';
const DIR = 'gate-baselines';
mkdirSync(DIR, { recursive: true });

// Clip rect: isolates 3D viewport (excludes sidebar/toolbar chrome)
const CLIP = { x: 335, y: 50, width: 920, height: 580 };

async function setSliderValue(page, selector, value) {
  await page.evaluate(({ sel, val }) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`Slider not found: ${sel}`);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(val));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { sel: selector, val: value });
}

async function waitForRender(page, ms = 3000) {
  await page.waitForTimeout(ms);
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  ctx.setDefaultTimeout(60000);
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await waitForRender(page, 5000);

  // 1. baseline-default.png — Industrial theme, TOD 15:00, single container
  await setSliderValue(page, '[data-testid="tod-slider"]', 15);
  await waitForRender(page);
  await page.screenshot({ path: `${DIR}/baseline-default.png`, clip: CLIP });
  console.log('Captured: baseline-default.png');

  // 2. baseline-midday.png — TOD 12:00
  await setSliderValue(page, '[data-testid="tod-slider"]', 12);
  await waitForRender(page);
  await page.screenshot({ path: `${DIR}/baseline-midday.png`, clip: CLIP });
  console.log('Captured: baseline-midday.png');

  // 3. baseline-golden-hour.png — TOD 17:30
  await setSliderValue(page, '[data-testid="tod-slider"]', 17.5);
  await waitForRender(page);
  await page.screenshot({ path: `${DIR}/baseline-golden-hour.png`, clip: CLIP });
  console.log('Captured: baseline-golden-hour.png');

  // 4. baseline-japanese-theme.png — Japanese theme via UI click
  await page.click('[data-testid="theme-japanese"]');
  await waitForRender(page);
  await page.screenshot({ path: `${DIR}/baseline-japanese-theme.png`, clip: CLIP });
  console.log('Captured: baseline-japanese-theme.png');

  // Restore industrial theme
  await page.click('[data-testid="theme-industrial"]');
  await setSliderValue(page, '[data-testid="tod-slider"]', 15);
  await waitForRender(page);

  // 5. baseline-blueprint.png — Blueprint view mode
  await page.click('[data-testid="view-blueprint"]');
  await waitForRender(page);
  await page.screenshot({ path: `${DIR}/baseline-blueprint.png`, clip: CLIP });
  console.log('Captured: baseline-blueprint.png');

  // Restore 3D view
  await page.click('[data-testid="view-3d"]');
  await waitForRender(page);

  // 6. baseline-staircase.png — After stair placement
  await page.evaluate(() => {
    const s = window.__store.getState();
    const ids = Object.keys(s.containers);
    if (ids.length > 0) {
      s.applyStairsFromFace(ids[0], 17, 'n');
    }
  });
  await waitForRender(page);
  await page.screenshot({ path: `${DIR}/baseline-staircase.png`, clip: CLIP });
  console.log('Captured: baseline-staircase.png');

  console.log(`\nAll baselines captured to ${DIR}/`);
  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
