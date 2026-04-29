// Visual verification of the 4 walkthrough-ready presets.
// Renders each preset, frames it, captures one screenshot.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots/walkthrough';
fs.mkdirSync(DIR, { recursive: true });

const PRESETS = [
  'walkthrough_1_studio',
  'walkthrough_2_duplex',
  'walkthrough_2_stacked_rooftop',
  'walkthrough_3_townhouse',
  'walkthrough_4_courtyard',
];

const browser = await chromium.launch();

for (const id of PRESETS) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => console.log('PAGE ERR', id, err.message));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+3');
  await page.waitForTimeout(700);

  const placedReport = await page.evaluate(([presetId]) => {
    const s = window.__store.getState();
    Object.keys(s.containers).forEach((cid) => s.removeContainer?.(cid));
    const ids = window.__store.getState().placeModelHome(presetId, [0, 0, 0]);
    const after = window.__store.getState();
    if (after.wizardOpen) after.closeWizard();
    // Inspect the door we requested.
    const grid = after.containers[ids[0]]?.voxelGrid ?? [];
    const door28 = grid[28];
    return {
      placed: ids.length,
      door28Surface: door28?.faces.s,
    };
  }, [id]);
  console.log(id, JSON.stringify(placedReport));

  await page.waitForTimeout(3500);

  // Mouse-orbit the camera to a useful framing.
  await page.mouse.move(1100, 550);
  await page.mouse.down();
  await page.mouse.move(900, 380, { steps: 25 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, -1500);
  await page.waitForTimeout(2500);

  const out = `${DIR}/${id}.png`;
  try {
    await page.screenshot({ path: out, timeout: 45000 });
    console.log('✓', out);
  } catch (e) {
    console.log('✗', out, e.message);
  }
  await ctx.close();
}

await browser.close();
console.log('done');
