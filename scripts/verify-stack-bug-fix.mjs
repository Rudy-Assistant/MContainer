/**
 * verify-stack-bug-fix.mjs
 *
 * One-off visual verification for the 2026-04-30 stacking-bug fix.
 * Drives Playwright directly (no /browse, no MCP) to:
 *   1. Open localhost:3100 in headless Chromium.
 *   2. Dismiss the Quick Setup modal.
 *   3. Seed the user's exact repro: 40' HC + Glass Box + drag-stack new 40' HC.
 *   4. Pose the camera so the stack is centered + framed.
 *   5. Capture before/after-style screenshots:
 *        - reference.png  : default ground state, no containers
 *        - bottom-only.png: 40' HC with Glass Box applied, no top yet
 *        - stacked.png    : same after dragging fresh 40' HC on top.
 *   6. Read store invariants and emit a JSON report.
 *
 * Run:  node scripts/verify-stack-bug-fix.mjs
 *       (with the dev server already running on http://localhost:3100)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = process.env.MODUHOME_BASE_URL || 'http://localhost:3100';
const OUT_DIR = path.resolve('verify-stack-bug-fix');
fs.mkdirSync(OUT_DIR, { recursive: true });

const log = (...a) => console.log('[verify]', ...a);

async function setCamera(page, fromX, fromY, fromZ, toX, toY, toZ) {
  await page.evaluate(
    ({ fx, fy, fz, tx, ty, tz }) => {
      const cc = window.cameraControlsRef?.current;
      if (cc?.setLookAt) cc.setLookAt(fx, fy, fz, tx, ty, tz, false);
    },
    { fx: fromX, fy: fromY, fz: fromZ, tx: toX, ty: toY, tz: toZ },
  );
}

async function dismissModalAndClear(page) {
  // Dismiss the Quick Setup modal
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    document
      .querySelectorAll('[role="dialog"], .modal, [class*="modal"]')
      .forEach((d) => {
        d.style.display = 'none';
      });
  });
  // Clear any persisted containers
  await page.evaluate(() => {
    const s = window.__store?.getState?.();
    if (!s) return;
    Object.keys(s.containers).forEach((id) => s.removeContainer(id));
  });
  await page.waitForTimeout(150);
}

async function readState(page) {
  return page.evaluate(() => {
    const VC = 8,
      VR = 4;
    const idx = (lvl, r, c) => lvl * VR * VC + r * VC + c;
    const s = window.__store.getState();
    const ids = Object.keys(s.containers);
    const summary = ids.map((id) => {
      const c = s.containers[id];
      const grid = c.voxelGrid;
      let bodySteel = 0,
        bodyOpenAll = 0,
        haloGlass = 0,
        animating = 0;
      for (let lvl = 0; lvl < 2; lvl++) {
        for (let r = 0; r < 4; r++) {
          for (let cc = 0; cc < 8; cc++) {
            const v = grid?.[idx(lvl, r, cc)];
            if (!v) continue;
            const isHalo = r === 0 || r === 3 || cc === 0 || cc === 7;
            if (v.unpackPhase === 'wall_to_floor') animating++;
            if (lvl === 0 && !isHalo && v.active) {
              if (
                ['n', 's', 'e', 'w'].some((f) => v.faces[f] === 'Solid_Steel')
              )
                bodySteel++;
              if (
                v.faces.n === 'Open' &&
                v.faces.s === 'Open' &&
                v.faces.e === 'Open' &&
                v.faces.w === 'Open'
              )
                bodyOpenAll++;
            }
            if (lvl === 0 && isHalo && v.active) {
              if (
                ['n', 's', 'e', 'w'].some((f) => v.faces[f] === 'Glass_Pane')
              )
                haloGlass++;
            }
          }
        }
      }
      return {
        id: id.slice(0, 8),
        level: c.level,
        stackedOn: c.stackedOn ? c.stackedOn.slice(0, 8) : null,
        appliedPreset: c.appliedPreset ?? null,
        posY: c.position.y,
        bodyVoxelsWithSteelWall: bodySteel,
        bodyVoxelsAllOpenWalls: bodyOpenAll,
        haloVoxelsWithGlassPane: haloGlass,
        animatingWallToFloor: animating,
      };
    });
    return summary;
  });
}

async function main() {
  // Headful Chromium with GPU enabled — Three.js / WebGL doesn't render in
  // headless mode on Windows without a real GPU context, leaving the canvas
  // solid black. Launch with the real GPU + a generous viewport so the
  // captured screenshots reflect the user's actual visible scene.
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--enable-gpu',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--window-size=1600,1000',
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();

  page.on('pageerror', (e) => log('PAGE ERROR:', e.message));

  log('navigating to', BASE);
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => !!window.__store, { timeout: 30000 });
  log('store ready');

  await dismissModalAndClear(page);

  // ─── Frame 1: reference state ────────────────────────────────────────
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '1-reference.png') });
  log('captured reference.png');

  // ─── Frame 2: bottom Glass Box ───────────────────────────────────────
  await page.evaluate(() => {
    const s = window.__store.getState();
    const id = s.addContainer('40ft_high_cube', { x: 0, y: 0, z: 0 }, 0, true);
    s.applyContainerArrangement(id, 'largest_glass');
  });
  await page.waitForTimeout(800);
  // Frame the bottom container — viewing from southeast at slight elevation
  await setCamera(page, 18, 8, 18, 0, 1.5, 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '2-glass-box-only.png') });
  log('captured glass-box-only.png');
  const stateBeforeStack = await readState(page);
  log('state before stack:', JSON.stringify(stateBeforeStack, null, 2));

  // ─── Frame 3: after stacking new 40' HC ──────────────────────────────
  await page.evaluate(() => {
    const s = window.__store.getState();
    const ids = Object.keys(s.containers);
    const bottomId = ids[0];
    const topId = s.addContainer(
      '40ft_high_cube',
      { x: 30, y: 0, z: 0 },
      0,
      true,
    );
    const ok = s.stackContainer(topId, bottomId);
    return ok;
  });
  await page.waitForTimeout(1000);
  // Pull the camera back + up so both stacked levels fit in frame
  await setCamera(page, 22, 12, 22, 0, 4, 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '3-stacked-after-fix.png') });
  log('captured stacked-after-fix.png');
  const stateAfterStack = await readState(page);
  log('state after stack:', JSON.stringify(stateAfterStack, null, 2));

  // ─── JSON report ─────────────────────────────────────────────────────
  const report = {
    timestamp: new Date().toISOString(),
    base: BASE,
    bug1_assertion: {
      description:
        'After stacking onto a Glass Box, the top container has no body voxels with Solid_Steel walls.',
      pass:
        stateAfterStack
          .filter((c) => c.stackedOn)
          .every((c) => c.bodyVoxelsWithSteelWall === 0),
      topContainers: stateAfterStack.filter((c) => c.stackedOn),
    },
    bug2_assertion: {
      description:
        'Stacking does not trigger any wall_to_floor unpack animations.',
      pass:
        stateAfterStack
          .filter((c) => c.stackedOn)
          .every((c) => c.animatingWallToFloor === 0),
      topContainers: stateAfterStack.filter((c) => c.stackedOn),
    },
    fullState: { beforeStack: stateBeforeStack, afterStack: stateAfterStack },
  };
  fs.writeFileSync(
    path.join(OUT_DIR, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  log('report written to', path.join(OUT_DIR, 'report.json'));

  await browser.close();
  log('done.');
}

main().catch((e) => {
  console.error('[verify] FAILED:', e);
  process.exit(1);
});
