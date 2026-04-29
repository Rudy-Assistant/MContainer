// Render-side probe for Wave A: counter tops, fixtures, decor, lighting.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots/wave-a';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERR:', err.message));
page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text()); });

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

// Wave A demos — 3 of each subsystem
const SHOTS = [
  // Counter tops
  { idx: 19, label: 'counter-base-quartz-white',
    setup: { kind: 'cabinet', tmpl: 'base_2door', skin: 'shaker_white', counterTop: 'quartz_white' } },
  { idx: 20, label: 'counter-base-walnut-block',
    setup: { kind: 'cabinet', tmpl: 'base_4drawer', skin: 'oak_natural', counterTop: 'butcher_block_walnut' } },
  { idx: 21, label: 'counter-vanity-marble',
    setup: { kind: 'cabinet', tmpl: 'bathroom_vanity', skin: 'walnut_dark', counterTop: 'marble_carrara' } },

  // Fixtures
  { idx: 22, label: 'fixture-fridge-french', setup: { kind: 'fixture', tmpl: 'fridge_french_door', open: 1 } },
  { idx: 23, label: 'fixture-range-pro', setup: { kind: 'fixture', tmpl: 'range_6burner', open: 0 } },
  { idx: 18, label: 'fixture-sink-double', setup: { kind: 'fixture', tmpl: 'sink_kitchen_double' } },
  { idx: 11, label: 'fixture-toilet', setup: { kind: 'fixture', tmpl: 'toilet_standard' } },
  { idx: 12, label: 'fixture-shower', setup: { kind: 'fixture', tmpl: 'shower_stall' } },
  { idx: 13, label: 'fixture-bathtub', setup: { kind: 'fixture', tmpl: 'bathtub_alcove' } },

  // Decor
  { idx: 14, label: 'decor-framed-walnut', setup: { kind: 'decor', tmpl: 'framed_picture_landscape', palette: 'frame_walnut' } },
  { idx: 15, label: 'decor-mirror-round', setup: { kind: 'decor', tmpl: 'mirror_round', palette: 'frame_brass' } },
  { idx: 16, label: 'decor-tv-75', setup: { kind: 'decor', tmpl: 'tv_75', palette: 'no_frame' } },
  { idx: 26, label: 'decor-clock', setup: { kind: 'decor', tmpl: 'wall_clock_round', palette: 'frame_black' } },
  { idx: 27, label: 'decor-gallery-grid', setup: { kind: 'decor', tmpl: 'gallery_grid', palette: 'frame_white' } },

  // Lighting
  { idx: 28, label: 'lighting-under-cabinet',
    setup: { kind: 'cabinet', tmpl: 'wall_2door', skin: 'shaker_white', underCabinetLight: true } },
  { idx: 29, label: 'lighting-glass-display',
    setup: { kind: 'cabinet', tmpl: 'glass_display_2door', skin: 'walnut_dark' } },
  { idx: 30, label: 'lighting-picture-light',
    setup: { kind: 'decor', tmpl: 'framed_picture_landscape', palette: 'frame_brass', pictureLight: true } },
];

await page.evaluate(({ cid, shots }) => {
  const s = window.__store.getState();
  for (const sh of shots) {
    const { kind, tmpl, skin, counterTop, open, palette, underCabinetLight, pictureLight } = sh.setup;
    if (kind === 'cabinet') s.setCabinetConfig(cid, sh.idx, 's', { template: tmpl, skin, counterTop, openAmount: open, underCabinetLight });
    else if (kind === 'fixture') s.setFixtureConfig(cid, sh.idx, 's', { template: tmpl, openAmount: open });
    else if (kind === 'decor') s.setDecorConfig(cid, sh.idx, 's', { template: tmpl, palette, pictureLight });
  }
}, { cid, shots: SHOTS });

await page.waitForTimeout(2500);

for (const shot of SHOTS) {
  await page.evaluate(({ cid, idx }) => {
    const s = window.__store.getState();
    s.setSelectedElements({ type: 'voxel', items: [{ containerId: cid, id: String(idx) }] });
    s.setSelectedFace('s');
  }, { cid, idx: shot.idx });
  await page.waitForTimeout(700);
  await page.screenshot({
    path: `${DIR}/inspector-${shot.label}.png`,
    clip: { x: 0, y: 60, width: 380, height: 740 },
    timeout: 60000,
    animations: 'disabled',
  });
  console.log(`inspector-${shot.label}.png`);
}

await browser.close();
console.log('done');
