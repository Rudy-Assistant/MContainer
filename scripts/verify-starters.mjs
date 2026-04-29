// Visual check of each new Starter Set.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots/starters';
fs.mkdirSync(DIR, { recursive: true });

const SETS = [
  { id: 'garden_pavilion',   cam: [14, 5, 14, 0, 1.2, 0] },
  { id: 'split_level_loft',  cam: [18, 8, 18, 3, 2, 0] },
  { id: 'corner_terrace',    cam: [22, 8, 20, 6, 1.5, 1.5] },
  { id: 'stacked_triplex',   cam: [20, 10, 22, 6, 3.5, 0] },
];

const browser = await chromium.launch();

for (const s of SETS) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+3');
  await page.waitForTimeout(600);

  await page.evaluate(([id]) => {
    const st = window.__store.getState();
    Object.keys(st.containers).forEach((cid) => st.removeContainer?.(cid));
    const s2 = window.__store.getState();
    s2.placeModelHome(id, [0, 0, 0]);
    const s3 = window.__store.getState();
    if (s3.wizardOpen) s3.closeWizard();
  }, [s.id]);
  await page.waitForTimeout(3500);

  // Mouse-orbit: setLookAt is flaky in headless without user input events.
  // A short drag from center to upper-right nudges the orbit controls into a good frame.
  await page.mouse.move(1100, 550);
  await page.mouse.down();
  await page.mouse.move(950, 380, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  // Wheel out to frame larger scenes.
  await page.mouse.wheel(0, -1200);
  await page.waitForTimeout(2000);

  const out = `${DIR}/${s.id}.png`;
  try { await page.screenshot({ path: out, timeout: 45000 }); console.log('✓', out); }
  catch (e) { console.log('✗', out, e.message); }
  await ctx.close();
}

await browser.close();
console.log('done');
