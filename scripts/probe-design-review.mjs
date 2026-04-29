// Capture screenshots of the main editor UI for design review
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();

async function shoot(viewport, filename, afterReady) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type()==='error') console.log('ERR', m.text().slice(0,200)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+3');
  await page.waitForTimeout(800);
  if (afterReady) await afterReady(page);
  await page.waitForTimeout(2500);
  const out = `${DIR}/${filename}`;
  try { await page.screenshot({ path: out, timeout: 30000 }); console.log('✓', out); } catch (e) { console.log('✗', out, e.message); }
  await ctx.close();
}

// 1. Desktop: default state (single container)
await shoot({ width: 1600, height: 900 }, 'desktop-default.png');

// 2. Desktop: with Two-Story loaded, camera framed
await shoot({ width: 1600, height: 900 }, 'desktop-two-story.png', async (page) => {
  await page.evaluate(() => {
    const s = window.__store.getState();
    Object.keys(s.containers).forEach((id) => s.removeContainer?.(id));
    window.__store.getState().placeModelHome('two_story', [0, 0, 0]);
  });
  await page.waitForTimeout(3000);
  await page.mouse.move(1000, 500);
  await page.mouse.down();
  await page.mouse.move(900, 350, { steps: 20 });
  await page.mouse.up();
});

// 3. Tablet (768) to evaluate responsive
await shoot({ width: 768, height: 1024 }, 'tablet-default.png');

// 4. Mobile (375)
await shoot({ width: 375, height: 812 }, 'mobile-default.png');

await browser.close();
