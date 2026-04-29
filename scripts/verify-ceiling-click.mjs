// Verify: with faceFilter='top', clicking the visible body of a container
// reaches the ceiling hitbox (not the front wall).
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

// Set up: a single full container with all voxels active.
await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((cid) => s.removeContainer?.(cid));
  if (s.wizardOpen) s.closeWizard();
  // Place the wraparound studio so we have an active container
  window.__store.getState().placeModelHome('walkthrough_1_studio', [0, 0, 0]);
  // Set face filter to top
  window.__store.getState().setFaceFilter('top');
});
await page.waitForTimeout(2000);

// Frame the container
await page.mouse.move(900, 500);
await page.mouse.down();
await page.mouse.move(800, 380, { steps: 25 });
await page.mouse.up();
await page.waitForTimeout(1000);
await page.mouse.wheel(0, -800);
await page.waitForTimeout(2000);

// Hover over the visible center of a container body voxel — this should now
// land on the ceiling hitbox (face='top') because walls have nullRaycast
// while the filter is 'top'.
await page.mouse.move(950, 450);
await page.waitForTimeout(1000);

// Read what the hover state shows.
const hoverState = await page.evaluate(() => {
  const s = window.__store.getState();
  return {
    faceFilter: s.faceFilter,
    hoveredVoxelEdge: s.hoveredVoxelEdge,
  };
});
console.log('After hover with filter=top:', JSON.stringify(hoverState));

await page.screenshot({ path: `${DIR}/ceiling-click-verify.png`, timeout: 45000 });
console.log('Screenshot saved');
await browser.close();
console.log('done');
