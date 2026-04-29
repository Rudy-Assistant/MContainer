// Render-side probe for shelf + cabinet overlays.
// Configures distinct shelf/cabinet templates × skins on south-facing voxels
// of a model home, captures the inspector preview for each (which uses the
// same FaceVisual component as the main canvas).
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots/shelves-cabinets';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERR:', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text());
});

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
await page.waitForTimeout(2500);

await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((cid) => s.removeContainer?.(cid));
  if (s.wizardOpen) s.closeWizard();
  window.__store.getState().placeModelHome('walkthrough_1_studio', [0, 0, 0]);
});
await page.waitForTimeout(1500);

const cid = await page.evaluate(() => Object.keys(window.__store.getState().containers)[0]);

// Shelves on a row of voxels. Wall surface stays as whatever the model home
// chose (typically Solid_Steel) — overlay rides on top.
const SHELVES = [
  { idx: 19, label: 'shelf-floating-oak', tmpl: 'floating_single', skin: 'oak_natural' },
  { idx: 20, label: 'shelf-bracket-steel', tmpl: 'bracket_single', skin: 'steel_industrial' },
  { idx: 21, label: 'shelf-wall3-walnut', tmpl: 'wall_unit_3', skin: 'walnut_dark' },
  { idx: 22, label: 'shelf-cubes-shaker', tmpl: 'cube_grid_2x2', skin: 'shaker_white' },
  { idx: 23, label: 'shelf-ladder-hinoki', tmpl: 'ladder', skin: 'hinoki_natural' },
];

// Cabinets: closed in first wave, open in second wave to exercise animation.
const CABINETS = [
  { idx: 11, label: 'cabinet-wall2-shaker', tmpl: 'wall_2door', skin: 'shaker_white' },
  { idx: 12, label: 'cabinet-base-doordrawer-navy', tmpl: 'base_door_drawer', skin: 'shaker_navy' },
  { idx: 13, label: 'cabinet-pantry-walnut', tmpl: 'tall_pantry', skin: 'walnut_dark' },
  { idx: 14, label: 'cabinet-glass-display', tmpl: 'glass_display_2door', skin: 'oak_natural' },
  { idx: 15, label: 'cabinet-vanity-mirror', tmpl: 'bathroom_vanity', skin: 'mirror_silver' },
  { idx: 16, label: 'cabinet-dresser6-bronze', tmpl: 'dresser_6drawer', skin: 'bronze_mirror' },
];

await page.evaluate(({ cid, shelves, cabinets }) => {
  const s = window.__store.getState();
  for (const sh of shelves) s.setShelfConfig(cid, sh.idx, 's', { template: sh.tmpl, skin: sh.skin });
  for (const cb of cabinets) s.setCabinetConfig(cid, cb.idx, 's', { template: cb.tmpl, skin: cb.skin });
}, { cid, shelves: SHELVES, cabinets: CABINETS });

await page.waitForTimeout(2000);

// Inspector screenshots (closed wave)
for (const item of [...SHELVES, ...CABINETS]) {
  await page.evaluate(({ cid, idx }) => {
    const s = window.__store.getState();
    s.setSelectedElements({ type: 'voxel', items: [{ containerId: cid, id: String(idx) }] });
    s.setSelectedFace('s');
  }, { cid, idx: item.idx });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: `${DIR}/inspector-${item.label}.png`,
    clip: { x: 0, y: 60, width: 380, height: 740 },
    timeout: 60000,
    animations: 'disabled',
  });
  console.log(`inspector-${item.label}.png`);
}

// Open all cabinets (animation wave)
await page.evaluate(({ cid, cabinets }) => {
  const s = window.__store.getState();
  for (const cb of cabinets) s.setCabinetConfig(cid, cb.idx, 's', { openAmount: 1 });
}, { cid, cabinets: CABINETS });
await page.waitForTimeout(2500);

for (const cb of CABINETS) {
  await page.evaluate(({ cid, idx }) => {
    const s = window.__store.getState();
    s.setSelectedElements({ type: 'voxel', items: [{ containerId: cid, id: String(idx) }] });
    s.setSelectedFace('s');
  }, { cid, idx: cb.idx });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: `${DIR}/inspector-${cb.label}-open.png`,
    clip: { x: 0, y: 60, width: 380, height: 740 },
    timeout: 60000,
    animations: 'disabled',
  });
  console.log(`inspector-${cb.label}-open.png`);
}

await browser.close();
console.log('done');
