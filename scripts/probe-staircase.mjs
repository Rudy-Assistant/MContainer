// Probe after both fixes: rooftop deck on proper level + smart floor-corner poles
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.env.OUT || 'gate-screenshots/probe-staircase-fixed.png';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();

page.on('pageerror', (err) => console.log('PAGE ERR:', err.message));
page.on('console', (msg) => {
  const t = msg.type();
  if (t === 'error') console.log(`[${t}]`, msg.text().slice(0, 300));
});

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
await page.waitForTimeout(2000);
await page.keyboard.press('Escape');
await page.keyboard.press('Alt+3');
await page.waitForTimeout(1000);

const placed = await page.evaluate(() => {
  const s = window.__store.getState();
  const existing = Object.keys(s.containers);
  existing.forEach((id) => s.removeContainer?.(id));
  const ids = window.__store.getState().placeModelHome('two_story', [0, 0, 0]);
  return { cleared: existing.length, placed: ids.length };
});
console.log('PLACED:', JSON.stringify(placed));

await page.waitForTimeout(4000);

// Orbit via mouse drag — the most reliable way to trigger camera movement in headless
await page.mouse.move(1000, 500);
await page.mouse.down();
await page.mouse.move(900, 350, { steps: 20 });
await page.mouse.up();
await page.waitForTimeout(1500);

fs.mkdirSync('gate-screenshots', { recursive: true });
try { await page.screenshot({ path: OUT, timeout: 30000 }); console.log('Screenshot:', OUT); } catch (e) { console.log('Screenshot failed:', e.message); }

await browser.close();
