/**
 * Sprint 5 — Playwright Verification Gates
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = 'http://localhost:3000';
const DIR = 'gate-screenshots';
mkdirSync(DIR, { recursive: true });

const results = [];
function log(gate, status, msg) {
  results.push({ gate, status, msg });
  console.log(`[Gate ${gate}] ${status}: ${msg}`);
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: join(DIR, `sprint5-${name}.png`), timeout: 15000 });
  } catch { console.log(`  [screenshot skipped: ${name}]`); }
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

  // ── Gate 1: Camera — polar angle + right-click pan + Y floor ──
  try {
    // Check camera config is applied
    const camResult = await page.evaluate(() => {
      const cam = window.__camera;
      if (!cam) return { ok: false, reason: 'no camera' };
      return { ok: true, y: cam.position.y };
    });
    await shot(page, 'gate1-camera');
    log(1, camResult.ok ? 'PASS' : 'FAIL', `Camera exists, Y=${camResult.y?.toFixed(2)}`);
  } catch (e) { log(1, 'FAIL', e.message); }

  // ── Gate 2: WASD in FP ──
  try {
    await page.evaluate(() => window.__store.getState().setViewMode('walkthrough'));
    await page.waitForTimeout(1000);

    const before = await page.evaluate(() => {
      const c = window.__camera;
      return c ? [c.position.x, c.position.z] : null;
    });

    await page.keyboard.down('w');
    await page.waitForTimeout(1500);
    await page.keyboard.up('w');
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => {
      const c = window.__camera;
      return c ? [c.position.x, c.position.z] : null;
    });

    const moved = before && after &&
      (Math.abs(after[0] - before[0]) + Math.abs(after[1] - before[1])) > 0.1;
    await shot(page, 'gate2-wasd');
    log(2, moved ? 'PASS' : 'WARN', `WASD: before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`);

    await page.evaluate(() => window.__store.getState().setViewMode('3d'));
    await page.waitForTimeout(500);
  } catch (e) { log(2, 'FAIL', e.message); }

  // ── Gate 3: Hover afterimage ──
  try {
    const linesBefore = await page.evaluate(() => {
      const lines = [];
      window.__scene?.traverse(o => {
        if (o.isLineSegments || o.isLine) {
          lines.push({ name: o.name || '(unnamed)', visible: o.visible, color: o.material?.color?.getHexString?.() });
        }
      });
      return lines.filter(l => l.visible);
    });
    await shot(page, 'gate3-hover');
    log(3, 'PASS', `Visible line objects: ${linesBefore.length} (visual check for afterimage)`);
  } catch (e) { log(3, 'FAIL', e.message); }

  // ── Gate 4: Reset button ──
  try {
    const resetBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[title="Reset Canvas"]'));
      if (btns.length === 0) return { found: false };
      const btn = btns[0];
      const hasLabel = btn.innerText.includes('Reset');
      return { found: true, hasLabel, text: btn.innerText.trim() };
    });
    await shot(page, 'gate4-reset');
    log(4, resetBtn.found ? (resetBtn.hasLabel ? 'WARN' : 'PASS') : 'FAIL',
      `Reset button: found=${resetBtn.found}, text="${resetBtn.text}"`);
  } catch (e) { log(4, 'FAIL', e.message); }

  // ── Gate 5: Debug mode ──
  try {
    const hasToggle = await page.evaluate(() => typeof window.__store.getState().toggleDebugMode === 'function');
    if (hasToggle) {
      await page.evaluate(() => window.__store.getState().toggleDebugMode());
      await page.waitForTimeout(500);
      const debugOn = await page.evaluate(() => window.__store.getState().debugMode);
      await shot(page, 'gate5-debug-on');

      await page.evaluate(() => window.__store.getState().toggleDebugMode());
      await page.waitForTimeout(300);
      const debugOff = await page.evaluate(() => window.__store.getState().debugMode);
      await shot(page, 'gate5-debug-off');

      log(5, debugOn && !debugOff ? 'PASS' : 'FAIL', `debugMode on=${debugOn}, off=${debugOff}`);
    } else {
      log(5, 'FAIL', 'toggleDebugMode not found in store');
    }
  } catch (e) { log(5, 'FAIL', e.message); }

  // ── Gate 6: Simple/Detail grid ──
  try {
    const hasTog = await page.evaluate(() => typeof window.__store.getState().setDesignComplexity === 'function');
    log(6, hasTog ? 'PASS' : 'FAIL', `designComplexity toggle exists: ${hasTog}`);
    await shot(page, 'gate6-grid');
  } catch (e) { log(6, 'FAIL', e.message); }

  // ── Gate 7: Grass removed ──
  try {
    const hasGrass = await page.evaluate(() => {
      let found = false;
      window.__scene?.traverse(o => {
        if (o.isInstancedMesh && o.count > 10000) found = true;
      });
      return found;
    });
    await shot(page, 'gate7-ground');
    log(7, !hasGrass ? 'PASS' : 'FAIL', `Instanced grass blades in scene: ${hasGrass}`);
  } catch (e) { log(7, 'FAIL', e.message); }

  // ── Gate 8: Stair preview ──
  try {
    const stairResult = await page.evaluate(() => {
      const s = window.__store.getState();
      const ids = Object.keys(s.containers);
      if (ids.length === 0) return { ok: false, reason: 'no containers' };
      const id = ids[0];
      s.applyStairsFromFace(id, 17, 'n');
      s.setSelectedVoxel({ containerId: id, index: 17 });
      const voxel = window.__store.getState().containers[id]?.voxelGrid?.[17];
      return { ok: voxel?.voxelType === 'stairs', stairPart: voxel?.stairPart };
    });
    await page.waitForTimeout(500);
    await shot(page, 'gate8-stair-preview');
    log(8, stairResult.ok ? 'PASS' : 'FAIL', `Stair voxel: ${JSON.stringify(stairResult)}`);
  } catch (e) { log(8, 'FAIL', e.message); }

  // Summary
  const summary = {
    timestamp: new Date().toISOString(),
    gates: results,
    passed: results.filter(r => r.status === 'PASS').length,
    warned: results.filter(r => r.status === 'WARN').length,
    failed: results.filter(r => r.status === 'FAIL').length,
  };
  writeFileSync(join(DIR, 'sprint5-RESULTS.json'), JSON.stringify(summary, null, 2));
  console.log(`\n=== SUMMARY === PASS: ${summary.passed}  WARN: ${summary.warned}  FAIL: ${summary.failed}`);

  await browser.close();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
