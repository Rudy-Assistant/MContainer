// Probe: place two_story (or similar 2-stack), apply glass_atrium to the L2
// container, then dump that container's voxel face state so we can see whether
// the walls are actually Glass_Pane (correct) or something else (bug).
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERR:', err.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
await page.waitForTimeout(2500);

const result = await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((id) => s.removeContainer?.(id));
  if (s.wizardOpen) s.closeWizard();
  // Place a 2-stack home
  const ids = window.__store.getState().placeModelHome('two_story', [0, 0, 0]);
  const upperId = window.__store.getState().containers[ids[1]] ? ids[1] : ids[0];
  // Apply glass_atrium to the upper container
  window.__store.getState().applyContainerArrangement(upperId, 'glass_atrium');

  const c = window.__store.getState().containers[upperId];
  const grid = c.voxelGrid;
  const VOXEL_COLS = 8, VOXEL_ROWS = 4;

  // Dump face counts grouped by level
  const summarize = (level) => {
    const top = {}, bottom = {}, n = {}, s_face = {}, e = {}, w = {};
    let active = 0;
    for (let row = 0; row < VOXEL_ROWS; row++) {
      for (let col = 0; col < VOXEL_COLS; col++) {
        const idx = level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
        const v = grid[idx];
        if (!v) continue;
        if (v.active) active++;
        const tally = (obj, k) => { obj[k] = (obj[k] || 0) + 1; };
        tally(top,    v.faces.top);
        tally(bottom, v.faces.bottom);
        tally(n,      v.faces.n);
        tally(s_face, v.faces.s);
        tally(e,      v.faces.e);
        tally(w,      v.faces.w);
      }
    }
    return { active, top, bottom, n, s: s_face, e, w };
  };

  // Specifically look at L0 perimeter body voxels (rows 1-2, cols 1 and 6 — body-edge walls)
  const perimeter = [];
  for (const [row, col, face] of [[1, 1, 'w'], [2, 1, 'w'], [1, 6, 'e'], [2, 6, 'e'], [1, 1, 'n'], [1, 6, 'n'], [2, 1, 's'], [2, 6, 's']]) {
    const idx = row * VOXEL_COLS + col;
    perimeter.push({ row, col, face, value: grid[idx]?.faces?.[face] });
  }

  return {
    upperId: upperId.slice(0, 8),
    appliedPreset: c.appliedPreset,
    L0: summarize(0),
    L1: summarize(1),
    perimeterSamples: perimeter,
  };
});

console.log(JSON.stringify(result, null, 2));

// Frame the upper container and screenshot.
await page.waitForTimeout(2000);
await page.mouse.move(1000, 550);
await page.mouse.down();
await page.mouse.move(880, 350, { steps: 25 });
await page.mouse.up();
await page.waitForTimeout(1500);
await page.mouse.wheel(0, -600);
await page.waitForTimeout(2000);
await page.screenshot({ path: '.gstack/design-reports/screenshots/glass-atrium-l2-fixed.png', timeout: 45000 });
console.log('Screenshot saved');
await browser.close();
