// Visual confirm of door/window template + skin picker UI in the Walls tab.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots/templates';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERR:', err.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
await page.waitForTimeout(2500);

// Set up: place a furnished walkthrough_1_studio (has a south-facing door
// at voxel 28 face 's'), then select that voxel + face so the picker shows.
await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((cid) => s.removeContainer?.(cid));
  if (s.wizardOpen) s.closeWizard();
  const ids = window.__store.getState().placeModelHome('walkthrough_1_studio', [0, 0, 0]);
  const cid = ids[0];
  // Set voxel 28's south face to Door + select
  window.__store.getState().setVoxelFace(cid, 28, 's', 'Door');
  window.__store.getState().setSelectedElements({
    type: 'voxel',
    items: [{ containerId: cid, id: '28' }],
  });
  window.__store.getState().setSelectedFace('s');
  window.__store.getState().setSelectedWallCategory('door');
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${DIR}/walls-tab-door-template-picker.png`, timeout: 45000 });
console.log('walls-tab-door-template-picker.png');

// Switch to a window face
await page.evaluate(() => {
  const s = window.__store.getState();
  const cid = Object.keys(s.containers)[0];
  s.setVoxelFace(cid, 28, 's', 'Window_Standard');
  s.setSelectedWallCategory('window');
});
await page.waitForTimeout(1000);
await page.screenshot({ path: `${DIR}/walls-tab-window-template-picker.png`, timeout: 45000 });
console.log('walls-tab-window-template-picker.png');

await browser.close();
console.log('done');
