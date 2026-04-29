// Focused post-change verification — captures editor at desktop / tablet / mobile.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots/after';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();

async function shoot(viewport, filename, { skipWizard = true, loadTwoStory = false } = {}) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+3');
  await page.waitForTimeout(800);
  if (skipWizard) {
    await page.evaluate(() => {
      const s = window.__store && window.__store.getState();
      if (s && s.wizardOpen) s.closeWizard();
    });
  }
  if (loadTwoStory) {
    await page.evaluate(() => {
      const s = window.__store.getState();
      Object.keys(s.containers).forEach((id) => s.removeContainer?.(id));
      window.__store.getState().placeModelHome('two_story', [0, 0, 0]);
      // Close the wizard if placing reopened it
      const s2 = window.__store.getState();
      if (s2.wizardOpen) s2.closeWizard();
    });
    await page.waitForTimeout(3500);
    await page.mouse.move(Math.floor(viewport.width * 0.65), Math.floor(viewport.height * 0.55));
    await page.mouse.down();
    await page.mouse.move(Math.floor(viewport.width * 0.55), Math.floor(viewport.height * 0.40), { steps: 20 });
    await page.mouse.up();
  }
  await page.waitForTimeout(2000);
  const out = `${DIR}/${filename}`;
  try {
    await page.screenshot({ path: out, timeout: 45000 });
    console.log('✓', out);
  } catch (e) {
    console.log('✗', out, e.message);
  }
  await ctx.close();
}

await shoot({ width: 1600, height: 900 }, 'desktop-editor.png');
await shoot({ width: 1600, height: 900 }, 'desktop-two-story.png', { loadTwoStory: true });
await shoot({ width: 768, height: 1024 }, 'tablet-editor.png');
await shoot({ width: 375, height: 812 }, 'mobile-gate.png', { skipWizard: false });

await browser.close();
console.log('done');
