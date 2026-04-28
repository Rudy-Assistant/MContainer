/**
 * Deeper user-story probe — targets interaction edges the prior 6-story
 * probe missed. Each story exercises a real user gesture and asserts on
 * the resulting store/DOM state.
 *
 * Stories covered:
 *   S1  Saved-tab → click Glass Atrium Showcase model-home card
 *   S2  Wizard → Ctrl+Z (undo) → does container revert?
 *   S3  Wizard glass_box → does any UI label show "Glass Box" preset?
 *   S4  Showcase loaded → switch to walkthrough mode → no console errors?
 *   S5  Place 2 adjacent containers → do walls auto-merge?
 *   S6  Showcase loaded → toggle dark mode → does it apply cleanly?
 *   S7  Showcase → camera framing — is the whole 8-container structure visible?
 *   S8  Apply wizard → click arrangement card → does the second override work?
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = `gate-baselines/qa-deep-${ts}`;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=gl', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(
  () => !!window.__store?.getState?.() && !!document.querySelector('canvas'),
  { timeout: 60000 },
);
await page.waitForTimeout(3500);

const issues = [];
const log = (s) => { console.log(s); fs.appendFileSync(`${outDir}/log.txt`, s + '\n'); };
const flag = (story, msg) => { issues.push({ story, msg }); log(`  [BUG] ${story}: ${msg}`); };

async function reset() {
  await page.evaluate(() => {
    const s = window.__store.getState();
    if (s.wizardOpen) s.closeWizard();
    Object.keys(s.containers).forEach((id) => s.removeContainer(id));
    s.clearSelection?.();
  });
  await page.waitForTimeout(400);
}

// ─────────── S1: Saved tab → click Glass Atrium Showcase card ───────────
log('\n=== S1: Click Glass Atrium Showcase from Saved tab ===');
await reset();
// The Sidebar Library renders in every view mode (DISC-1). Just expand the
// sidebar if collapsed — no view-mode change needed to reach the Saved tab.
await page.evaluate(() => {
  const s = window.__store.getState();
  if (s.sidebarCollapsed) s.toggleSidebar();
});
await page.waitForTimeout(300);
// Click the "saved" tab
const savedClicked = await page.evaluate(() => {
  const sb = document.querySelector('[data-testid="sidebar-expanded"]');
  if (!sb) return { ok: false, reason: 'no sidebar-expanded' };
  const sbButtons = Array.from(sb.querySelectorAll('button'));
  const sbTexts = sbButtons.slice(0, 12).map((b) => b.textContent?.trim().slice(0, 25));
  const btn = sbButtons.find((b) => /^saved$/i.test(b.textContent?.trim() ?? ''));
  if (!btn) return { ok: false, sbTexts };
  btn.click();
  return { ok: true, sbTexts };
});
log(`  Saved tab click: ${JSON.stringify(savedClicked)}`);
await page.waitForTimeout(400);
const showcaseCard = await page.evaluate(() => {
  const card = document.querySelector('[data-testid="model-home-glass_atrium_showcase"]');
  if (!card) return { found: false };
  const r = card.getBoundingClientRect();
  return { found: true, label: card.textContent?.slice(0, 60), visible: r.width > 0 && r.height > 0 };
});
log(`  Showcase card: ${JSON.stringify(showcaseCard)}`);
if (!showcaseCard.found) flag('S1', 'Glass Atrium Showcase not rendered in Saved tab');

// Click the card
if (showcaseCard.found) {
  await page.evaluate(() => { window.confirm = () => true; });
  await page.evaluate(() => document.querySelector('[data-testid="model-home-glass_atrium_showcase"]').click());
  await page.waitForFunction(() => Object.keys(window.__store.getState().containers).length === 8, {
    timeout: 15000,
  }).catch(() => {});
  const placed = await page.evaluate(() => Object.keys(window.__store.getState().containers).length);
  log(`  After card click — containers: ${placed}`);
  if (placed !== 8) flag('S1', `Card click placed ${placed} containers, expected 8`);
}
await page.screenshot({ path: `${outDir}/s1-after-card-click.png` });

// ─────────── S2: Wizard → undo → revert? ───────────
log('\n=== S2: Wizard then undo ===');
await reset();
const undoResult = await page.evaluate(async () => {
  const s = window.__store.getState();
  const id = s.addContainer();
  await new Promise((r) => setTimeout(r, 100));
  const before = window.__store.getState().containers[id];
  const beforeHasGlass =
    before?.voxelGrid?.some((v) =>
      Object.values(v.faces).some((f) => f === 'Glass_Pane' || f === 'Window_Standard'),
    ) ?? false;
  s.applyWizardPreset(id, 'glass_box');
  await new Promise((r) => setTimeout(r, 200));
  const afterWizard = window.__store.getState().containers[id];
  const afterHasGlass =
    afterWizard?.voxelGrid?.some((v) =>
      Object.values(v.faces).some((f) => f === 'Glass_Pane' || f === 'Window_Standard'),
    ) ?? false;
  // Trigger undo
  window.__store.temporal?.getState()?.undo();
  await new Promise((r) => setTimeout(r, 200));
  const afterUndo = window.__store.getState().containers[id];
  const afterUndoHasGlass =
    afterUndo?.voxelGrid?.some((v) =>
      Object.values(v.faces).some((f) => f === 'Glass_Pane' || f === 'Window_Standard'),
    ) ?? false;
  return {
    beforeHasGlass,
    afterHasGlass,
    afterUndoHasGlass,
    appliedPresetBefore: before?.appliedPreset,
    appliedPresetAfter: afterWizard?.appliedPreset,
    appliedPresetUndo: afterUndo?.appliedPreset,
  };
});
log(`  ${JSON.stringify(undoResult)}`);
if (undoResult.afterHasGlass && undoResult.afterUndoHasGlass) {
  flag('S2', 'Undo did not revert glass walls — wizard changes survive Ctrl+Z');
}
if (undoResult.appliedPresetUndo === 'glass_box') {
  flag('S2', 'Undo did not clear appliedPreset wizard ID');
}

// ─────────── S3: Wizard glass_box — does any UI label show it? ───────────
log('\n=== S3: Wizard preset surfaced in UI? ===');
await reset();
// Mirror the real WizardModal flow: apply + select the target so the Inspector
// mounts and the applied-preset chip becomes visible. The Modal's handleApply
// does the same select() call.
await page.evaluate(() => {
  const s = window.__store.getState();
  const id = s.addContainer();
  s.applyWizardPreset(id, 'glass_box');
  s.select(id);
});
await page.waitForTimeout(800);
// Look for any visible "Glass Box" text in the UI
const surfaceCheck = await page.evaluate(() => {
  const texts = [];
  document.querySelectorAll('*').forEach((el) => {
    if (el.children.length === 0 && el.textContent && /glass.box|glass_box/i.test(el.textContent)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) texts.push(el.textContent.trim().slice(0, 40));
    }
  });
  return [...new Set(texts)];
});
log(`  UI text mentions of "glass box": ${JSON.stringify(surfaceCheck)}`);
if (surfaceCheck.length === 0) {
  flag('S3', 'appliedPreset="glass_box" not surfaced in Inspector after apply+select');
}

// ─────────── S4: Showcase → walkthrough mode → console clean? ───────────
log('\n=== S4: Walkthrough mode after showcase ===');
await reset();
await page.evaluate(() => {
  window.__store.getState().placeModelHome('glass_atrium_showcase');
});
await page.waitForFunction(() => Object.keys(window.__store.getState().containers).length === 8, {
  timeout: 15000,
});
await page.waitForTimeout(2500);
consoleErrors.length = 0; // Reset before walkthrough
await page.evaluate(() => {
  window.__store.getState().setViewMode('walkthrough');
});
await page.waitForTimeout(1500);
const wm = await page.evaluate(() => window.__store.getState().viewMode);
log(`  viewMode after switch: ${wm}`);
log(`  console errors during walkthrough mount: ${consoleErrors.length}`);
if (consoleErrors.length > 0) {
  consoleErrors.forEach((e) => log(`    ! ${e.slice(0, 200)}`));
  flag('S4', `${consoleErrors.length} console errors when entering walkthrough mode`);
}
await page.screenshot({ path: `${outDir}/s4-walkthrough.png` });

// ─────────── S5: Adjacent containers — auto-merge? ───────────
log('\n=== S5: Adjacent containers auto-merge ===');
await reset();
await page.evaluate(() => window.__store.getState().setViewMode('realistic3d'));
await page.waitForTimeout(300);
const mergeRes = await page.evaluate(() => {
  const s = window.__store.getState();
  // Length of HC40 is 12.19, width 2.44. Place 2 side-by-side along Z (north-south adjacent).
  const a = s.addContainer();
  s.updateContainerPosition(a, { x: 0, y: 0, z: 0 });
  const b = s.addContainer();
  s.updateContainerPosition(b, { x: 0, y: 0, z: 2.44 }); // Touching south face
  s.refreshAdjacency();
  return { a, b };
});
await page.waitForTimeout(800);
const adjacency = await page.evaluate(({ a, b }) => {
  const ca = window.__store.getState().containers[a];
  const cb = window.__store.getState().containers[b];
  return {
    aMerged: ca?.mergedWalls ?? [],
    bMerged: cb?.mergedWalls ?? [],
  };
}, mergeRes);
log(`  ${JSON.stringify(adjacency)}`);
if (adjacency.aMerged.length === 0 && adjacency.bMerged.length === 0) {
  flag('S5', 'Adjacent containers did not auto-merge (mergedWalls empty)');
}

// ─────────── S6: Showcase + dark mode toggle ───────────
log('\n=== S6: Dark mode toggle on showcase ===');
await reset();
await page.evaluate(() => window.__store.getState().placeModelHome('glass_atrium_showcase'));
await page.waitForFunction(() => Object.keys(window.__store.getState().containers).length === 8, {
  timeout: 15000,
});
await page.waitForTimeout(1500);
consoleErrors.length = 0;
const beforeTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await page.evaluate(() => window.__store.getState().toggleDarkMode?.());
await page.waitForTimeout(500);
const afterTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
log(`  data-theme: ${beforeTheme} → ${afterTheme}`);
log(`  console errors during dark toggle: ${consoleErrors.length}`);
if (afterTheme === beforeTheme) flag('S6', `toggleDarkMode did not flip data-theme: ${beforeTheme}→${afterTheme}`);
if (consoleErrors.length > 0) flag('S6', `${consoleErrors.length} console errors during dark toggle`);

// ─────────── S7: Showcase camera framing ───────────
log('\n=== S7: Camera framing on showcase load ===');
const camInfo = await page.evaluate(() => {
  const cc = window.__cameraControls;
  if (!cc) return { hasCC: false };
  // Distance from origin to camera
  const p = cc.getPosition();
  return {
    hasCC: true,
    cameraPos: [Math.round(p.x), Math.round(p.y), Math.round(p.z)],
    distanceFromOrigin: Math.round(Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z)),
  };
});
log(`  ${JSON.stringify(camInfo)}`);
// Showcase footprint is ~24m x ~5m x ~6m (2x2 of 12.19x2.44 with stacking).
// Camera should be far enough to see it (distance > ~20m).
if (camInfo.hasCC && camInfo.distanceFromOrigin < 15) {
  flag('S7', `Camera too close: ${camInfo.distanceFromOrigin}m — showcase fills viewport`);
}

// ─────────── S8: Wizard → arrangement card override ───────────
log('\n=== S8: Wizard then arrangement override ===');
await reset();
const overrideRes = await page.evaluate(() => {
  const s = window.__store.getState();
  const id = s.addContainer();
  s.applyWizardPreset(id, 'glass_box');
  const after1 = window.__store.getState().containers[id];
  const ap1 = after1?.appliedPreset;
  // Now apply a different arrangement
  s.applyContainerArrangement(id, 'central_atrium');
  const after2 = window.__store.getState().containers[id];
  const ap2 = after2?.appliedPreset;
  // Sample faces — central_atrium should have void at center
  const idx = (row, col) => row * 8 + col;
  const centerTop = after2?.voxelGrid?.[idx(1, 3)]?.faces?.top;
  return { ap1, ap2, centerTop };
});
log(`  ${JSON.stringify(overrideRes)}`);
if (overrideRes.ap1 !== 'glass_box') flag('S8', `Wizard didn't set appliedPreset='glass_box', got: ${overrideRes.ap1}`);
if (overrideRes.ap2 !== 'central_atrium') flag('S8', `Override didn't set appliedPreset='central_atrium', got: ${overrideRes.ap2}`);
if (overrideRes.centerTop !== 'Open') flag('S8', `central_atrium void didn't apply — center top=${overrideRes.centerTop}`);

// ─────────── Final report ───────────
log(`\n=== ISSUES (${issues.length}) ===`);
issues.forEach((i) => log(`  [${i.story}] ${i.msg}`));
log(`\n=== CONSOLE ERRORS (${consoleErrors.length}) ===`);
consoleErrors.slice(0, 10).forEach((e) => log(`  ! ${e.slice(0, 200)}`));

fs.writeFileSync(
  `${outDir}/report.md`,
  `# Deep QA Report ${ts}\n\n## Issues (${issues.length})\n\n${issues.map((i) => `- **[${i.story}]** ${i.msg}`).join('\n') || '(none)'}\n\n## Console Errors (${consoleErrors.length})\n\n${consoleErrors.slice(0, 20).map((e) => `- ${e.slice(0, 300)}`).join('\n') || '(none)'}\n\n## Log\n\n\`\`\`\n${fs.readFileSync(`${outDir}/log.txt`, 'utf8')}\n\`\`\`\n`,
);

await browser.close();
log(`\nReport: ${outDir}/report.md`);
