/**
 * visual-regression.mjs — Visual regression gate.
 *
 * Captures a small set of canonical inspector-preview screenshots
 * (one per overlay type), compares each against a committed baseline,
 * and exits non-zero if any frame drifts beyond the per-fixture
 * threshold. Diff PNGs land in .gstack/design-reports/visual-diffs/
 * for inspection.
 *
 * Run:
 *   node scripts/visual-regression.mjs           # compare only
 *   node scripts/visual-regression.mjs --update  # rewrite baselines
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { compareToBaseline } from './compare-screenshots.mjs';

const BASELINE_DIR = '.gstack/visual-baselines';
const DIFF_DIR = '.gstack/design-reports/visual-diffs';
const THRESHOLD = 0.03; // 3% per-fixture diff allowed (camera + lighting micro-jitter)

const update = process.argv.includes('--update');
fs.mkdirSync(BASELINE_DIR, { recursive: true });
fs.mkdirSync(DIFF_DIR, { recursive: true });

const FIXTURES = [
  { name: 'door-french-walnut', setup: (cid) => ({ kind: 'door', idx: 19, face: 's', tmpl: 'french_double', skin: 'walnut_glazed' }) },
  { name: 'window-double-hung', setup: () => ({ kind: 'window', idx: 22, face: 's', tmpl: 'double_hung', skin: 'wood_natural' }) },
  { name: 'cabinet-pantry-walnut', setup: () => ({ kind: 'cabinet', idx: 13, face: 's', tmpl: 'tall_pantry', skin: 'walnut_dark' }) },
  { name: 'fixture-fridge-french', setup: () => ({ kind: 'fixture', idx: 22, face: 's', tmpl: 'fridge_french_door' }) },
  { name: 'decor-mirror-round', setup: () => ({ kind: 'decor', idx: 15, face: 's', tmpl: 'mirror_round', palette: 'frame_brass' }) },
  { name: 'shelf-wall-3-walnut', setup: () => ({ kind: 'shelf', idx: 21, face: 's', tmpl: 'wall_unit_3', skin: 'walnut_dark' }) },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERR:', err.message));

await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
await page.waitForTimeout(2500);

// Place a base scene
await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((cid) => s.removeContainer?.(cid));
  if (s.wizardOpen) s.closeWizard();
  window.__store.getState().placeModelHome('walkthrough_1_studio', [0, 0, 0]);
});
await page.waitForTimeout(1500);

const cid = await page.evaluate(() => Object.keys(window.__store.getState().containers)[0]);

const failures = [];
let totalCompared = 0;

for (const fx of FIXTURES) {
  const cfg = fx.setup(cid);
  await page.evaluate(({ cid, cfg }) => {
    const s = window.__store.getState();
    if (cfg.kind === 'door') {
      s.setVoxelFace(cid, cfg.idx, cfg.face, 'Door');
      s.setDoorConfig(cid, cfg.idx, cfg.face, { template: cfg.tmpl, skin: cfg.skin });
    } else if (cfg.kind === 'window') {
      s.setVoxelFace(cid, cfg.idx, cfg.face, 'Window_Standard');
      s.setWindowConfig(cid, cfg.idx, cfg.face, { template: cfg.tmpl, skin: cfg.skin });
    } else if (cfg.kind === 'cabinet') {
      s.setCabinetConfig(cid, cfg.idx, cfg.face, { template: cfg.tmpl, skin: cfg.skin });
    } else if (cfg.kind === 'fixture') {
      s.setFixtureConfig(cid, cfg.idx, cfg.face, { template: cfg.tmpl });
    } else if (cfg.kind === 'decor') {
      s.setDecorConfig(cid, cfg.idx, cfg.face, { template: cfg.tmpl, palette: cfg.palette });
    } else if (cfg.kind === 'shelf') {
      s.setShelfConfig(cid, cfg.idx, cfg.face, { template: cfg.tmpl, skin: cfg.skin });
    }
    s.setSelectedElements({ type: 'voxel', items: [{ containerId: cid, id: String(cfg.idx) }] });
    s.setSelectedFace(cfg.face);
  }, { cid, cfg });
  await page.waitForTimeout(900);
  const buf = await page.screenshot({ clip: { x: 0, y: 60, width: 380, height: 740 }, animations: 'disabled' });

  const baselinePath = path.join(BASELINE_DIR, `${fx.name}.png`);
  if (update || !fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, buf);
    console.log(`[wrote baseline] ${fx.name}`);
    continue;
  }
  const diffPath = path.join(DIFF_DIR, `${fx.name}.diff.png`);
  const result = compareToBaseline(buf, baselinePath, diffPath, THRESHOLD);
  totalCompared++;
  if (result.match) {
    console.log(`✓ ${fx.name} — ${(result.diffPercent * 100).toFixed(2)}% diff`);
  } else {
    console.log(`✗ ${fx.name} — ${(result.diffPercent * 100).toFixed(2)}% diff (threshold ${(THRESHOLD * 100).toFixed(1)}%) — diff at ${diffPath}`);
    failures.push({ name: fx.name, diffPercent: result.diffPercent });
  }
}

await browser.close();

console.log('');
if (update) {
  console.log(`Updated ${FIXTURES.length} baselines.`);
  process.exit(0);
}
console.log(`Compared ${totalCompared} fixtures, ${failures.length} failures.`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f.name}: ${(f.diffPercent * 100).toFixed(2)}% drift`);
  process.exit(1);
}
process.exit(0);
