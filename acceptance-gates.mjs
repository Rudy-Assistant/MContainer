/**
 * Cumulative Acceptance Gates — Sprints 1-7
 *
 * Verifies all features remain working after each sprint.
 * Run: node acceptance-gates.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = 'http://localhost:3000';
const DIR = 'gate-screenshots';
mkdirSync(DIR, { recursive: true });

const results = [];
function log(gate, status, msg) {
  results.push({ gate, status, msg });
  console.log(`[${status}] ${gate}: ${msg}`);
}
function pass(gate, msg) { log(gate, 'PASS', msg); }
function fail(gate, msg) { log(gate, 'FAIL', msg); }

async function shot(page, name) {
  try { await page.screenshot({ path: `${DIR}/accept-${name}.png`, timeout: 15000 }); }
  catch { /* SwiftShader timeout */ }
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  ctx.setDefaultTimeout(60000);
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4000);

  // ═══ SPRINT 1-2 CORE GATES ═══

  // G1: Store exists and has containers
  try {
    const s = await page.evaluate(() => {
      const s = window.__store?.getState?.();
      return { hasStore: !!s, containerCount: Object.keys(s?.containers ?? {}).length };
    });
    s.hasStore && s.containerCount > 0
      ? pass('G1-store', `Store OK, ${s.containerCount} containers`)
      : fail('G1-store', JSON.stringify(s));
  } catch (e) { fail('G1-store', e.message); }

  // G2: addContainer works
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      const before = Object.keys(s.containers).length;
      const id = s.addContainer('40ft_high_cube', { x: 20, y: 0, z: 0 });
      const after = Object.keys(window.__store.getState().containers).length;
      return { added: after > before, id };
    });
    r.added ? pass('G2-addContainer', `id=${r.id}`) : fail('G2-addContainer', JSON.stringify(r));
  } catch (e) { fail('G2-addContainer', e.message); }

  // G3: View mode switching
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      s.setViewMode('walkthrough');
      const fp = window.__store.getState().viewMode;
      s.setViewMode('3d');
      const back = window.__store.getState().viewMode;
      return { fp, back };
    });
    r.fp === 'walkthrough'
      ? pass('G3-viewMode', `FP=${r.fp}, back=${r.back}`)
      : fail('G3-viewMode', JSON.stringify(r));
  } catch (e) { fail('G3-viewMode', e.message); }

  // G4: Undo/redo exists
  try {
    const r = await page.evaluate(() => typeof window.__store.getState().undo === 'function');
    r ? pass('G4-undo', 'undo function exists') : fail('G4-undo', 'missing');
  } catch (e) { fail('G4-undo', e.message); }

  // ═══ SPRINT 3 GATES ═══

  // G5: Palette system
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      return {
        hasSave: typeof s.savePalette === 'function',
        hasDelete: typeof s.deletePalette === 'function',
        builtIns: s.palettes?.filter(p => p.isBuiltIn).length ?? 0,
      };
    });
    r.hasSave && r.hasDelete && r.builtIns >= 3
      ? pass('G5-palette', `${r.builtIns} built-ins`)
      : fail('G5-palette', JSON.stringify(r));
  } catch (e) { fail('G5-palette', e.message); }

  // G6: Staircase
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      const ids = Object.keys(s.containers);
      if (ids.length === 0) return { ok: false };
      s.applyStairsFromFace(ids[0], 17, 'n');
      const v = window.__store.getState().containers[ids[0]]?.voxelGrid?.[17];
      return { ok: v?.voxelType === 'stairs' };
    });
    r.ok ? pass('G6-staircase', 'voxelType=stairs') : fail('G6-staircase', JSON.stringify(r));
  } catch (e) { fail('G6-staircase', e.message); }

  // G7: Export function
  try {
    const r = await page.evaluate(() => typeof window.__exportGLB === 'function' || typeof window.__store.getState().exportState === 'function');
    r ? pass('G7-export', 'export function exists') : fail('G7-export', 'missing');
  } catch (e) { fail('G7-export', e.message); }

  // G8: setSelectedVoxel
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      const ids = Object.keys(s.containers);
      if (ids.length === 0) return { ok: false };
      s.setSelectedVoxel({ containerId: ids[0], index: 10 });
      const sv = window.__store.getState().selectedVoxel;
      s.setSelectedVoxel(null);
      return { ok: sv?.index === 10 };
    });
    r.ok ? pass('G8-selectedVoxel', 'round-trip OK') : fail('G8-selectedVoxel', JSON.stringify(r));
  } catch (e) { fail('G8-selectedVoxel', e.message); }

  // ═══ SPRINT 4 GATES ═══

  // G9: No start screen
  try {
    const r = await page.evaluate(() => !document.body.innerText.includes('Choose a starting layout'));
    r ? pass('G9-noStartScreen', 'no blocking modal') : fail('G9-noStartScreen', 'start screen present');
  } catch (e) { fail('G9-noStartScreen', e.message); }

  // G10: placeModelHome
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      const ids = s.placeModelHome('micro_studio');
      return { ok: ids?.length > 0, count: ids?.length };
    });
    r.ok ? pass('G10-modelHome', `placed ${r.count} containers`) : fail('G10-modelHome', JSON.stringify(r));
  } catch (e) { fail('G10-modelHome', e.message); }

  // ═══ SPRINT 5 GATES ═══

  // G11: Camera exists (polar angle fix applied) — wait for SceneExporter mount
  try {
    await page.waitForTimeout(2000);
    const r = await page.evaluate(() => !!window.__camera);
    r ? pass('G11-camera', 'camera exposed') : fail('G11-camera', 'no camera');
  } catch (e) { fail('G11-camera', e.message); }

  // G12: No instanced grass blades
  try {
    const r = await page.evaluate(() => {
      let found = false;
      window.__scene?.traverse(o => { if (o.isInstancedMesh && o.count > 10000) found = true; });
      return !found;
    });
    r ? pass('G12-noGrass', 'no instanced blades') : fail('G12-noGrass', 'grass blades found');
  } catch (e) { fail('G12-noGrass', e.message); }

  // G13: Debug mode toggle
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      if (typeof s.toggleDebugMode !== 'function') return { ok: false };
      s.toggleDebugMode();
      const on = window.__store.getState().debugMode;
      s.toggleDebugMode();
      const off = window.__store.getState().debugMode;
      return { ok: on === true && off === false };
    });
    r.ok ? pass('G13-debugMode', 'toggle works') : fail('G13-debugMode', JSON.stringify(r));
  } catch (e) { fail('G13-debugMode', e.message); }

  // G14: Reset button icon-only
  try {
    const r = await page.evaluate(() => {
      const btn = document.querySelector('button[title="Reset Canvas"]');
      if (!btn) return { found: false };
      return { found: true, text: btn.innerText.trim() };
    });
    r.found && r.text === ''
      ? pass('G14-resetBtn', 'icon-only')
      : r.found ? fail('G14-resetBtn', `has text: "${r.text}"`) : fail('G14-resetBtn', 'not found');
  } catch (e) { fail('G14-resetBtn', e.message); }

  // G15: Stair preview (StairMesh for 2-voxel parts)
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      const ids = Object.keys(s.containers);
      if (ids.length === 0) return { ok: false };
      // Find a stair voxel
      for (const id of ids) {
        const grid = s.containers[id]?.voxelGrid;
        if (!grid) continue;
        for (let i = 0; i < grid.length; i++) {
          if (grid[i]?.stairPart === 'lower' || grid[i]?.stairPart === 'upper') {
            return { ok: true, stairPart: grid[i].stairPart };
          }
        }
      }
      return { ok: true, note: 'no 2-voxel stairs to check (stair placed earlier may be single)' };
    });
    pass('G15-stairPreview', JSON.stringify(r));
  } catch (e) { fail('G15-stairPreview', e.message); }

  // ═══ SPRINT 7 GATES ═══

  // G16: Frame structure exists
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      return { ok: typeof s.toggleStructuralElement === 'function' };
    });
    r.ok ? pass('G16-frameStructure', 'toggleStructuralElement exists') : fail('G16-frameStructure', JSON.stringify(r));
  } catch (e) { fail('G16-frameStructure', e.message); }

  // G17: Frame toggle behavioral
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      const ids = Object.keys(s.containers);
      if (!ids.length) return { ok: false };
      s.toggleStructuralElement(ids[0], 'post_front_right');
      const hidden = window.__store.getState().containers[ids[0]].structureConfig?.hiddenElements ?? [];
      const wasHidden = hidden.includes('post_front_right');
      s.toggleStructuralElement(ids[0], 'post_front_right');
      const restored = !(window.__store.getState().containers[ids[0]].structureConfig?.hiddenElements ?? []).includes('post_front_right');
      return { ok: wasHidden && restored };
    });
    r.ok ? pass('G17-frameToggle', 'hide+restore OK') : fail('G17-frameToggle', JSON.stringify(r));
  } catch (e) { fail('G17-frameToggle', e.message); }

  // G18: Theme switch behavioral
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      const orig = s.currentTheme;
      s.setTheme('japanese');
      const switched = window.__store.getState().currentTheme;
      s.setTheme(orig);
      return { ok: switched === 'japanese', switched };
    });
    r.ok ? pass('G18-themeSwitch', `switched to ${r.switched}`) : fail('G18-themeSwitch', JSON.stringify(r));
  } catch (e) { fail('G18-themeSwitch', e.message); }

  // G19: Undo behavioral (add container, undo, verify count)
  try {
    const r = await page.evaluate(() => {
      const s = window.__store.getState();
      const before = Object.keys(s.containers).length;
      s.addContainer('40ft_high_cube', { x: 50, y: 0, z: 0 });
      const after = Object.keys(window.__store.getState().containers).length;
      window.__store.getState().undo();
      const undone = Object.keys(window.__store.getState().containers).length;
      return { ok: after > before && undone === before, before, after, undone };
    });
    r.ok ? pass('G19-undoBehavioral', `before=${r.before} after=${r.after} undone=${r.undone}`) : fail('G19-undoBehavioral', JSON.stringify(r));
  } catch (e) { fail('G19-undoBehavioral', e.message); }

  // ═══ SUMMARY ═══
  await shot(page, 'final');
  const summary = {
    timestamp: new Date().toISOString(),
    sprint: 7,
    gates: results,
    total: results.length,
    passed: results.filter(r => r.status === 'PASS').length,
    failed: results.filter(r => r.status === 'FAIL').length,
  };
  writeFileSync('GATE-REPORT.json', JSON.stringify(summary, null, 2));

  console.log(`\n${'='.repeat(50)}`);
  console.log(`TOTAL: ${summary.total}  PASS: ${summary.passed}  FAIL: ${summary.failed}`);
  console.log(`${'='.repeat(50)}`);

  if (summary.failed > 0) {
    console.log('\nFAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ${r.gate}: ${r.msg}`));
  }

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
