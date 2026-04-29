// Render-side probe for door + window template/skin pass.
// Places a walkthrough_1_studio, applies several non-default
// template+skin combos to its south face wall, captures the 3D viewport.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots/templates';
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

// Place a furnished walkthrough_1_studio + apply template/skin variety
// to several visible south-face voxels.
await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((cid) => s.removeContainer?.(cid));
  if (s.wizardOpen) s.closeWizard();
  const ids = window.__store.getState().placeModelHome('walkthrough_1_studio', [0, 0, 0]);
  const cid = ids[0];

  // Set up FOUR south-facing faces with different template/skin combos.
  // Voxel indices in row=2 (south-facing on a 4x8 grid): 18..23 (cols 2..7).
  const setVoxelFace = window.__store.getState().setVoxelFace;
  const setDoorConfig = window.__store.getState().setDoorConfig;
  const setWindowConfig = window.__store.getState().setWindowConfig;

  // 1) French double doors with walnut+glass — voxel index 19
  setVoxelFace(cid, 19, 's', 'Door');
  setDoorConfig(cid, 19, 's', { template: 'french_double', skin: 'walnut_glazed' });

  // 2) Garage roll-up with steel industrial — voxel index 20
  setVoxelFace(cid, 20, 's', 'Door');
  setDoorConfig(cid, 20, 's', { template: 'garage_roll', skin: 'steel_industrial' });

  // 3) Dutch door painted white — voxel index 21
  setVoxelFace(cid, 21, 's', 'Door');
  setDoorConfig(cid, 21, 's', { template: 'dutch', skin: 'painted_white' });

  // 4) Double-hung window in natural wood — voxel index 22
  setVoxelFace(cid, 22, 's', 'Window_Standard');
  setWindowConfig(cid, 22, 's', { template: 'double_hung', skin: 'wood_natural' });

  // 5) Bay window in painted black — voxel index 23
  setVoxelFace(cid, 23, 's', 'Window_Standard');
  setWindowConfig(cid, 23, 's', { template: 'bay_three_panel', skin: 'painted_black_window' });

  // 6) Jalousie louvres — voxel index 18
  setVoxelFace(cid, 18, 's', 'Window_Half');
  setWindowConfig(cid, 18, 's', { template: 'jalousie', skin: 'aluminum_white' });
});
await page.waitForTimeout(1500);

// Diagnostic: confirm the container actually exists and find a good camera target.
const diag = await page.evaluate(() => {
  const s = window.__store.getState();
  const cids = Object.keys(s.containers);
  const out = { count: cids.length, ids: cids, voxelCounts: {}, positions: {} };
  for (const cid of cids) {
    const c = s.containers[cid];
    const grid = c?.voxelGrid ?? [];
    out.voxelCounts[cid] = grid.filter((v) => v?.active).length;
    out.positions[cid] = c?.position;
  }
  return out;
});
console.log('DIAG containers:', JSON.stringify(diag));

// Inspector's VoxelPreview3D uses the SAME FaceVisual component, so selecting
// each voxel and screenshotting the left panel exercises the renderer pass
// without depending on the main canvas camera state.
//
// First wave (closed): exercise template+skin combinations.
// Second wave (open): exercise per-template motion animations driven by
// openAmount (windows) and state (doors).
const SHOTS = [
  { idx: 19, face: 's', label: 'french-double-walnut' },
  { idx: 20, face: 's', label: 'garage-roll-steel' },
  { idx: 21, face: 's', label: 'dutch-painted-white' },
  { idx: 22, face: 's', label: 'double-hung-wood-natural' },
  { idx: 23, face: 's', label: 'bay-three-painted-black' },
  { idx: 18, face: 's', label: 'jalousie-aluminum-white' },
];

// Animation-exercising voxels — different templates so we cover each motion.
// We'll add windows + doors and toggle them open after the first pass.
const ANIM_SHOTS = [
  { idx: 10, face: 's', kind: 'window', tmpl: 'casement_single', skin: 'wood_natural', label: 'casement-single-open' },
  { idx: 11, face: 's', kind: 'window', tmpl: 'casement_double', skin: 'aluminum_black', label: 'casement-double-open' },
  { idx: 12, face: 's', kind: 'window', tmpl: 'awning_top_hinge', skin: 'painted_white_window', label: 'awning-open' },
  { idx: 13, face: 's', kind: 'window', tmpl: 'hopper_bottom_hinge', skin: 'aluminum_black', label: 'hopper-open' },
  { idx: 14, face: 's', kind: 'window', tmpl: 'sliding_horizontal', skin: 'aluminum_white', label: 'sliding-window-open' },
  { idx: 15, face: 's', kind: 'window', tmpl: 'double_hung', skin: 'wood_natural', label: 'double-hung-open' },
  { idx: 16, face: 's', kind: 'window', tmpl: 'jalousie', skin: 'aluminum_white', label: 'jalousie-open' },
  { idx: 26, face: 'n', kind: 'door', tmpl: 'sliding_single', skin: 'aluminum_black_glazed', label: 'sliding-single-door-open' },
  { idx: 27, face: 'n', kind: 'door', tmpl: 'sliding_double', skin: 'walnut_glazed', label: 'sliding-double-door-open' },
  { idx: 28, face: 'n', kind: 'door', tmpl: 'barn', skin: 'oak_reclaimed', label: 'barn-door-open' },
];

const cid = await page.evaluate(() => Object.keys(window.__store.getState().containers)[0]);

for (const shot of SHOTS) {
  await page.evaluate(({ cid, idx, face }) => {
    const s = window.__store.getState();
    s.setSelectedElements({ type: 'voxel', items: [{ containerId: cid, id: String(idx) }] });
    s.setSelectedFace(face);
  }, { cid, idx: shot.idx, face: shot.face });
  await page.waitForTimeout(900);
  // Crop the left sidebar (inspector) — known layout: ~360px wide.
  await page.screenshot({
    path: `${DIR}/inspector-${shot.label}.png`,
    clip: { x: 0, y: 60, width: 380, height: 740 },
    timeout: 60000,
    animations: 'disabled',
  });
  console.log(`inspector-${shot.label}.png`);
}

// ── Second wave: motion animations ──
// Configure each animation voxel + open it.
await page.evaluate(({ cid, shots }) => {
  const s = window.__store.getState();
  for (const shot of shots) {
    s.setVoxelFace(cid, shot.idx, shot.face, shot.kind === 'door' ? 'Door' : 'Window_Standard');
    if (shot.kind === 'door') {
      s.setDoorConfig(cid, shot.idx, shot.face, { template: shot.tmpl, skin: shot.skin, state: 'open_slide' });
    } else {
      s.setWindowConfig(cid, shot.idx, shot.face, { template: shot.tmpl, skin: shot.skin, openAmount: 1 });
    }
  }
}, { cid, shots: ANIM_SHOTS });

// Wait for animations to settle (lerp constant 0.001 over 60Hz settles in ~1.5s)
await page.waitForTimeout(2500);

for (const shot of ANIM_SHOTS) {
  await page.evaluate(({ cid, idx, face }) => {
    const s = window.__store.getState();
    s.setSelectedElements({ type: 'voxel', items: [{ containerId: cid, id: String(idx) }] });
    s.setSelectedFace(face);
  }, { cid, idx: shot.idx, face: shot.face });
  await page.waitForTimeout(900);
  await page.screenshot({
    path: `${DIR}/inspector-${shot.label}.png`,
    clip: { x: 0, y: 60, width: 380, height: 740 },
    timeout: 60000,
    animations: 'disabled',
  });
  console.log(`inspector-${shot.label}.png`);
}

// Force a clean camera shot from the south of the container
await page.evaluate(() => {
  const s = window.__store.getState();
  if (typeof s.setViewLevel === 'function') s.setViewLevel(null);
  const cc = window.__cameraControls;
  if (cc) {
    cc.setPosition(7, 4, 10, false);
    cc.setTarget(0, 1.4, 0, false);
  }
});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${DIR}/door-window-templates-overview.png`, timeout: 60000, animations: 'disabled' });
console.log('door-window-templates-overview.png');

// Toggle french_double open so swing geometry is exercised
await page.evaluate(() => {
  const s = window.__store.getState();
  const cid = Object.keys(s.containers)[0];
  s.setDoorConfig(cid, 19, 's', { state: 'open_swing' });
});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${DIR}/door-window-templates-french-open.png`, timeout: 60000, animations: 'disabled' });
console.log('door-window-templates-french-open.png');

await browser.close();
console.log('done');
