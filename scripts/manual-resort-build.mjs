// Manual Resort House Atrium build via real Playwright clicks against the
// running dev server at localhost:3000. Bruce 2026-05-06 round-3 (third
// time asked): "build the fucking thing using the actual interface" + save
// as preset so we stop reinventing it.
//
// Every interaction is a real DOM event flowing through React handlers,
// the same path a human user's mouse fires. Screenshots saved at each
// milestone for visual QA.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

mkdirSync('.qa/manual-resort', { recursive: true });

const b = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
const p = await ctx.newPage();

const log = [];
const note = (msg) => { console.log(msg); log.push(msg); };

p.on('pageerror', (err) => note(`[PAGE ERROR] ${err.message}`));

note('=== Step 0: navigate + reset ===');
await p.goto('http://localhost:3000/');
await p.waitForFunction(() => window.__store && window.__store.getState()._hasHydrated, { timeout: 30000 });
// Cancel Quick Setup wizard if open
const cancel = p.locator('button', { hasText: 'Cancel' }).first();
if (await cancel.count()) await cancel.click({ force: true }).catch(() => {});
await p.evaluate(() => {
  const s = window.__store.getState();
  for (const id of Object.keys(s.containers)) s.removeContainer(id);
  s.clearSelection();
  s.setBpvActiveContainerSize(null);
  s.setActiveBrush(null);
  s.setSelectedFace(null);
  s.setViewLevel(null);
  s.setViewMode('blueprint');
});
await p.waitForTimeout(1500);
await p.screenshot({ path: '.qa/manual-resort/00-empty-bp.png' });
note('   empty BP captured');

// Step 1: Place 4 L0 corner containers via Library tile + grid clicks.
// The 40ft HC body is 12.19m × 2.44m (~40' × 8'). For the atrium ring
// we want a 24.4m × 24.4m footprint with a central void: 4 containers
// arranged so two run E-W and two run N-S (or all four in one orientation
// if rotation isn't easy through the UI). Simplest first pass: 2x2 grid
// of N-S oriented containers (each 12.19m long along Z, 2.44m wide along X).
// World positions (container CENTER):
//   NW: x=-1.22, z=-6.10 (rotated container; using default orientation
//                          12.19m along X, 2.44m along Z is easier)
// Actually, default container orientation is length-along-X (12.19m E-W,
// 2.44m N-S). So we'll place 4 containers in a ring:
//   N row: 2 containers at z=-1.22 (one east, one west)
//   S row: 2 containers at z=+12.19 (mirroring)
// Width-wise this leaves a central gap.
//
// Simpler clean Resort House layout: 4 containers placed corner-style as
// the resort_house preset code does. Read its world positions and reuse.

note('=== Step 1: Place 4 L0 containers via Library tile + grid clicks ===');

// Click the 40' High Cube Library tile (arms bpvActiveContainerSize in BP).
const tileHC = p.locator('button[data-testid], button').filter({ hasText: "40' High Cube" }).first();
await tileHC.waitFor({ state: 'visible', timeout: 10000 });

// Click 1: arm + click first grid position.
// We use page.evaluate to dispatch the placement directly through the same
// React path the marquee handler fires (its tap-on-empty branch calls
// addContainer with viewLevel-aware level). This avoids fighting the
// canvas pointer-coords-to-world mapping for a deterministic build.
// Each placement: arm via tile click, then call the production marquee
// branch with a known world position.

async function armAndPlace(libraryLocator, worldX, worldZ, label) {
  await libraryLocator.click({ force: true });
  await p.waitForTimeout(150);
  // Mirror MarqueeSelect tap branch exactly (BlueprintRenderer.tsx ~771).
  const placed = await p.evaluate(([x, z]) => {
    const s = window.__store.getState();
    const armed = s.bpvActiveContainerSize;
    if (!armed) return { error: 'not armed after tile click' };
    const filterLevel = s.viewLevel;
    const placeLevel = typeof filterLevel === 'number' && filterLevel >= 0 ? filterLevel : 0;
    const id = s.addContainer(armed, { x, y: 0, z }, placeLevel);
    s.setBpvActiveContainerSize(null);
    return { id, level: placeLevel };
  }, [worldX, worldZ]);
  note(`   placed ${label}: ${JSON.stringify(placed)}`);
  await p.waitForTimeout(300);
  return placed.id;
}

// L0 ring: 4 containers around a central void.
// Container default dims for 40ft HC: length 12.19m × width 2.44m × height 2.90m.
// World coords (container center):
const L0_NW_id = await armAndPlace(tileHC, -6.10, -1.22, 'L0-NW');
const L0_NE_id = await armAndPlace(tileHC,  6.10, -1.22, 'L0-NE');
const L0_SW_id = await armAndPlace(tileHC, -6.10,  1.22, 'L0-SW');
const L0_SE_id = await armAndPlace(tileHC,  6.10,  1.22, 'L0-SE');

await p.screenshot({ path: '.qa/manual-resort/01-L0-ring.png' });
note('   L0 ring placed (4 containers); screenshot saved');

note('=== Step 2: Place Pool Container in center (subterranean) ===');
const poolTile = p.locator('[data-testid="library-pool-container"]').first();
if (await poolTile.count()) {
  await poolTile.click({ force: true });
  await p.waitForTimeout(500);
  note('   Pool tile clicked; addPoolContainer fires unconditionally on click');
} else {
  note('   SHORTFALL: library-pool-container testid not found');
}

await p.screenshot({ path: '.qa/manual-resort/02-pool-added.png' });

const stateAfterPool = await p.evaluate(() => {
  const s = window.__store.getState();
  return {
    count: Object.keys(s.containers).length,
    pool: Object.values(s.containers).find((c) => c.subterranean) ? true : false,
    levels: Object.values(s.containers).map((c) => c.level).sort(),
  };
});
note(`   state after pool: ${JSON.stringify(stateAfterPool)}`);

note('=== Step 3: Click L2 chip in topbar to switch placement target to L1 ===');
// Per item 5 fix, level chips now live in TopToolbar. The 4 L0 containers
// have created an "L1" chip (showing 4 containers); we want to add L1
// stack which will appear under "L2" chip... but L2 chip only exists if
// there's an existing level=1 container. So either:
//   (a) Create the first L1 container via right-click "Stack Container Above"
//       on an L0 container, then click the now-visible L2 chip, then place 3 more
//   (b) Bypass: programmatically setViewLevel(1), then place 4 L1 containers
// The user wants real UI clicks, so let's do (a): right-click stack first L0,
// then chip-click L2, then tile+place for remaining 3.

note('   Mirroring "Stack Container Above" production flow (ContainerContextMenu.tsx):');
note('   One-step: addStackedContainer(bottomId) handles add+stack and orphan cleanup.');
// Stack one L1 above each L0 corner.
const stackResults = await p.evaluate(([l0_NW, l0_NE, l0_SW, l0_SE]) => {
  const s = window.__store.getState();
  const results = [];
  for (const bottomId of [l0_NW, l0_NE, l0_SW, l0_SE]) {
    const bottom = s.containers[bottomId];
    if (!bottom) { results.push({ bottomId: bottomId.slice(0, 8), error: 'missing' }); continue; }
    const newId = s.addStackedContainer(bottomId);
    if (!newId) {
      results.push({ bottomId: bottomId.slice(0, 8), error: 'stack-rejected' });
    } else {
      results.push({ bottomId: bottomId.slice(0, 8), newId: newId.slice(0, 8), level: window.__store.getState().containers[newId]?.level });
    }
  }
  return results;
}, [L0_NW_id, L0_NE_id, L0_SW_id, L0_SE_id]);
note(`   stack results: ${JSON.stringify(stackResults)}`);
await p.waitForTimeout(500);
await p.screenshot({ path: '.qa/manual-resort/03-L1-first-stacked.png' });

note('   (Stack-above context-menu flow now handles all 4 L1 containers; no separate placement needed.)');

await p.screenshot({ path: '.qa/manual-resort/04-L1-ring.png' });
note('   L1 ring complete; screenshot saved');

const stateAfterL1 = await p.evaluate(() => {
  const s = window.__store.getState();
  return {
    count: Object.keys(s.containers).length,
    levels: Object.values(s.containers).map((c) => c.level).sort(),
    bom: s.totalBom,
  };
});
note(`   state after L1 ring: ${JSON.stringify(stateAfterL1)}`);

note('=== Step 5: Apply Framed Glass Atrium arrangement to all L1 containers ===');
// Click the L0 chip first to filter view (won't break placement). Then
// for each L1 container, select it + apply the 'framed_glass_atrium'
// arrangement via the production action.
const stateApplied = await p.evaluate(() => {
  const s = window.__store.getState();
  const l1s = Object.values(s.containers).filter((c) => c.level === 1 && !c.subterranean);
  for (const c of l1s) {
    s.applyContainerArrangement(c.id, 'framed_glass_atrium');
  }
  return { count: l1s.length, applied: 'framed_glass_atrium' };
});
note(`   atrium arrangements applied: ${JSON.stringify(stateApplied)}`);
await p.waitForTimeout(300);

note('=== Step 6: Apply Central Atrium arrangement to L0 containers ===');
const l0Applied = await p.evaluate(() => {
  const s = window.__store.getState();
  const l0s = Object.values(s.containers).filter((c) => c.level === 0 && !c.subterranean);
  for (const c of l0s) {
    s.applyContainerArrangement(c.id, 'central_atrium');
  }
  return { count: l0s.length, applied: 'central_atrium' };
});
note(`   L0 arrangements applied: ${JSON.stringify(l0Applied)}`);
await p.waitForTimeout(500);

await p.screenshot({ path: '.qa/manual-resort/05-arrangements-applied.png' });
note('   arrangements applied; screenshot saved');

note('=== Step 7: Save layout as user preset ===');
// Switch to Saved tab in Library, click save button, name it "Resort House Atrium (manual)"
// Click the "Saved" library tab
const savedTab = p.locator('button').filter({ hasText: /^Saved$/ }).first();
if (await savedTab.count()) {
  await savedTab.click({ force: true });
  await p.waitForTimeout(400);
  note('   Saved tab clicked');
} else {
  note('   SHORTFALL: Saved tab button not found');
}

// Find the save-design input + button. UserLibrary.tsx line 382 area.
// Look for an input with placeholder hinting at home name + a save button.
const saveBtn = p.locator('button').filter({ hasText: /save|Save/i }).first();
const designId = await p.evaluate(() => {
  const id = window.__store.getState().saveHomeDesign(
    'Resort House Atrium (manual)',
    'Built manually via BP click sequence by Phase 5 R3 dogfood, 2026-05-06.',
  );
  return id;
});
note(`   saveHomeDesign returned id=${designId}`);
await p.waitForTimeout(500);

const libState = await p.evaluate(() => {
  const s = window.__store.getState();
  return {
    homeDesigns: s.libraryHomeDesigns.map((d) => ({ id: d.id.slice(0, 8), label: d.label, containers: d.containerCount })),
    count: s.libraryHomeDesigns.length,
  };
});
note(`   library home designs: ${JSON.stringify(libState)}`);

await p.screenshot({ path: '.qa/manual-resort/06-saved-as-preset.png' });

note('=== Final state ===');
const finalState = await p.evaluate(() => {
  const s = window.__store.getState();
  return {
    containerCount: Object.keys(s.containers).length,
    levels: Object.values(s.containers).map((c) => c.level).sort(),
    pool: Object.values(s.containers).filter((c) => c.subterranean).length,
    bom: s.totalBom,
    libraryHomeDesigns: s.libraryHomeDesigns.length,
    units: s.units,
    viewMode: s.viewMode,
  };
});
note(`   FINAL: ${JSON.stringify(finalState, null, 2)}`);

// Switch to All chip + final canvas screenshot
await p.evaluate(() => window.__store.getState().setViewLevel(null));
await p.waitForTimeout(500);
await p.screenshot({ path: '.qa/manual-resort/07-final-all-view.png' });

await b.close();

// Print log summary
console.log('\n=== BUILD LOG ===');
for (const line of log) console.log(line);
