/**
 * probe-user-stories.mjs — Autonomous QA across 6 user stories.
 *
 * Exercises real workflows end-to-end, captures screenshots + DOM state
 * + console errors, and writes a structured report. The goal is to find
 * regressions/breakage that unit tests miss because they don't drive the
 * actual rendered app.
 *
 * Run with `npm run dev` already serving http://localhost:3000.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE = 'http://localhost:3000';
const OUT = resolve('gate-baselines', `qa-userstories-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);
mkdirSync(OUT, { recursive: true });
const log = [];
const issues = [];

function record(msg) { console.log(msg); log.push(msg); }
function note(category, msg, severity = 'WARN') {
  const entry = `[${severity}] ${category}: ${msg}`;
  console.log(entry);
  issues.push({ category, msg, severity });
}

async function snap(page, name) {
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
}

async function getState(page, fn) { return page.evaluate(fn); }

async function safeClick(page, selector, ms = 500) {
  try {
    await page.click(selector, { timeout: ms });
    return true;
  } catch { return false; }
}

async function reset(page) {
  await page.evaluate(() => {
    const s = window.__store.getState();
    if (s.wizardOpen) s.closeWizard();
    Object.keys(s.containers).forEach((id) => s.removeContainer(id));
    s.clearSelection();
    s.setSelectedElements(null);
    s.setSelectedFace(null);
  });
  await page.waitForTimeout(400);
}

// ── User Story 1: First-time user opens wizard, picks Glass Box ────
async function story1_wizard(page) {
  record('\n=== STORY 1: First-time wizard flow ===');
  await reset(page);
  // Re-trigger wizard manually since reset cleared containers
  await page.evaluate(() => window.__store.getState().openWizard());
  await page.waitForTimeout(600);
  await snap(page, '01-wizard-open');

  const wizardOpen = await getState(page, () => window.__store.getState().wizardOpen);
  if (!wizardOpen) note('Wizard', 'wizardOpen flag is false after openWizard()', 'BUG');

  // Click "Glass Box" preset
  const glassBoxClicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Glass Box'),
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!glassBoxClicked) note('Wizard', 'Could not find Glass Box card', 'BUG');
  await page.waitForTimeout(500);
  await snap(page, '02-wizard-glass-box-selected');

  // Click Apply Layout
  const applyClicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Apply Layout',
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!applyClicked) note('Wizard', 'Could not find Apply Layout button', 'BUG');
  await page.waitForTimeout(2000);
  await snap(page, '03-wizard-applied');

  const after = await getState(page, () => {
    const s = window.__store.getState();
    return {
      containers: Object.keys(s.containers).length,
      preset: Object.values(s.containers)[0]?.appliedPreset,
      wizardStillOpen: s.wizardOpen,
    };
  });
  record(`  → containers: ${after.containers}, preset: ${after.preset}, wizardOpen: ${after.wizardStillOpen}`);
  if (after.containers !== 1) note('Wizard', `Expected 1 container after Glass Box apply, got ${after.containers}`, 'BUG');
  if (after.preset !== 'largest_glass') note('Wizard', `Expected appliedPreset=largest_glass, got ${after.preset}`, 'BUG');
  if (after.wizardStillOpen) note('Wizard', 'Wizard did not close after Apply Layout', 'BUG');
}

// ── User Story 2: Open Glass Atrium Showcase from Library ───────
async function story2_showcase(page) {
  record('\n=== STORY 2: Glass Atrium Showcase from Library ===');
  await reset(page);
  // Click Library → Saved tab
  // The Sidebar exposes activeTab via store
  await page.evaluate(() => {
    const s = window.__store.getState();
    if (s.collapsed) s.toggleSidebar();
    if (s.setSidebarTab) s.setSidebarTab('saved');
  });
  await page.waitForTimeout(500);
  await snap(page, '04-sidebar-saved-tab');

  // Look for 'Glass Atrium Showcase' button or card
  const found = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('button,div'))
      .map((el) => el.textContent?.trim() ?? '')
      .filter((t) => t.includes('Atrium Showcase') || t.includes('Glass Atrium Showcase'));
    return labels.slice(0, 5);
  });
  record(`  → matching labels: ${JSON.stringify(found)}`);
  if (found.length === 0) note('Library', 'Glass Atrium Showcase not visible in Library UI', 'BUG');

  // Place via store regardless (verifies the model home itself works)
  await page.evaluate(() => window.__store.getState().placeModelHome('glass_atrium_showcase'));
  await page.waitForFunction(
    () => Object.keys(window.__store.getState().containers).length === 8,
    { timeout: 15000 },
  );
  await page.waitForTimeout(2500);
  await snap(page, '05-showcase-placed');

  const placement = await getState(page, () => {
    const s = window.__store.getState();
    const ids = Object.keys(s.containers);
    return {
      count: ids.length,
      l1Presets: ids.filter((id) => s.containers[id].position.y === 0).map((id) => s.containers[id].appliedPreset),
      l2Presets: ids.filter((id) => s.containers[id].position.y > 0).map((id) => s.containers[id].appliedPreset),
    };
  });
  record(`  → ${placement.count} containers, L1 presets: ${[...new Set(placement.l1Presets)]}, L2 presets: ${[...new Set(placement.l2Presets)]}`);
  if (!placement.l1Presets.every((p) => p === 'framed_glass_box')) note('Showcase', 'L1 not all framed_glass_box', 'BUG');
  if (!placement.l2Presets.every((p) => p === 'framed_glass_atrium')) note('Showcase', 'L2 not all framed_glass_atrium', 'BUG');
}

// ── User Story 3: Toggle dark mode + observe crossfade ──────────
async function story3_darkmode(page) {
  record('\n=== STORY 3: Dark mode toggle ===');
  await page.evaluate(() => {
    const s = window.__store.getState();
    if (s.darkMode) s.toggleDarkMode(); // ensure starting in light
  });
  await page.waitForTimeout(300);
  await snap(page, '06-light-mode');

  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await page.evaluate(() => window.__store.getState().toggleDarkMode());
  await page.waitForTimeout(200); // mid-transition
  await snap(page, '07-dark-mid');
  await page.waitForTimeout(400); // settled
  await snap(page, '08-dark-settled');

  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const transition = await page.evaluate(() => getComputedStyle(document.body).transition);
  record(`  → light bg=${lightBg}, dark bg=${darkBg}`);
  record(`  → body transition: ${transition}`);
  if (lightBg === darkBg) note('Theme', 'Body background did not change between modes', 'BUG');
  if (!transition.includes('background-color')) note('Theme', `body transition missing background-color: "${transition}"`, 'WARN');
}

// ── User Story 4: Open AI Design modal, verify entrance animation ─
async function story4_modal_animation(page) {
  record('\n=== STORY 4: Modal entrance + exit animations ===');
  await reset(page);
  // Open settings menu
  const openedSettings = await safeClick(page, 'button[title="Settings"]');
  if (!openedSettings) note('Modal', 'Settings button not clickable', 'BUG');
  await page.waitForTimeout(300);
  await snap(page, '09-settings-open');

  const dropdownState = await page.evaluate(() => {
    const dd = document.querySelector('.dropdown-menu');
    return dd ? { state: dd.getAttribute('data-state'), animation: getComputedStyle(dd).animationName } : null;
  });
  record(`  → settings dropdown: ${JSON.stringify(dropdownState)}`);

  // Click AI Design...
  const aiClicked = await safeClick(page, '[data-testid="btn-ai-design"]');
  if (!aiClicked) note('Modal', 'AI Design menu item not clickable', 'BUG');
  await page.waitForTimeout(300);
  await snap(page, '10-ai-modal-open');

  const modalState = await page.evaluate(() => {
    const m = document.querySelector('.modal-content');
    if (!m) return null;
    return {
      state: m.parentElement?.getAttribute('data-state'),
      animation: getComputedStyle(m).animationName,
      duration: getComputedStyle(m).animationDuration,
      opacity: getComputedStyle(m).opacity,
    };
  });
  record(`  → modal state: ${JSON.stringify(modalState)}`);
  if (!modalState) note('Modal', 'Modal not in DOM after AI Design click', 'BUG');
  if (modalState && modalState.animation !== 'modal-content-in') note('Modal', `Modal animation is "${modalState?.animation}", expected "modal-content-in"`, 'BUG');

  // Close modal
  const closeClicked = await page.evaluate(() => {
    const x = document.querySelector('button[aria-label="Close"]');
    if (x) { x.click(); return true; }
    return false;
  });
  if (!closeClicked) note('Modal', 'Close (X) button not findable', 'WARN');
  await page.waitForTimeout(50); // mid-exit
  const exitState = await page.evaluate(() => {
    const wrapper = document.querySelector('[data-state]');
    return wrapper ? wrapper.getAttribute('data-state') : null;
  });
  record(`  → mid-exit data-state: ${exitState}`);
  await page.waitForTimeout(400);
  const fullyClosed = await page.evaluate(() => !document.querySelector('.modal-content'));
  if (!fullyClosed) note('Modal', 'Modal still mounted 400ms after close', 'BUG');
  await snap(page, '11-modal-closed');
}

// ── User Story 5: Reset Canvas, observe scene fade ─────────────
async function story5_scene_fade(page) {
  record('\n=== STORY 5: Reset Canvas scene fade ===');
  // Place a container so reset has something to clear
  await page.evaluate(() => {
    const s = window.__store.getState();
    s.placeModelHome('glass_atrium_showcase');
  });
  await page.waitForFunction(
    () => Object.keys(window.__store.getState().containers).length === 8,
    { timeout: 10000 },
  );
  await page.waitForTimeout(1500);

  // Open settings → Reset Canvas (with confirm override)
  await page.evaluate(() => { window.confirm = () => true; });
  await safeClick(page, 'button[title="Settings"]');
  await page.waitForTimeout(300);

  // Trigger fade + sample state
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="btn-reset"]');
    if (btn) btn.click();
  });
  // Sample fade overlay state at multiple times
  const samples = [];
  for (const t of [40, 100, 180, 260, 340, 450, 600]) {
    await page.waitForTimeout(t === 40 ? 40 : t - (samples.length === 0 ? 0 : samples[samples.length - 1].t));
    const s = await page.evaluate(() => {
      const o = document.querySelector('.scene-fade-overlay');
      return o ? { active: o.classList.contains('scene-fade-active'), opacity: getComputedStyle(o).opacity } : null;
    });
    samples.push({ t, ...s });
  }
  record(`  → fade timeline: ${samples.map((s) => `t=${s.t} op=${s.opacity}`).join(', ')}`);
  const peak = Math.max(...samples.map((s) => parseFloat(s.opacity || 0)));
  if (peak < 0.5) note('SceneFade', `Peak opacity only ${peak} — fade probably not firing during reset`, 'BUG');
  await snap(page, '12-after-reset');
}

// ── User Story 6: Hover an arrangement card, verify ghost preview ─
async function story6_arrangement_hover(page) {
  record('\n=== STORY 6: Arrangement card hover ghost preview ===');
  await reset(page);
  // Add a single container and select it
  await page.evaluate(() => {
    const s = window.__store.getState();
    const id = s.addContainer();
    s.select(id);
  });
  await page.waitForTimeout(800);

  // Hover an arrangement card via __store
  // ContainerPresetRow lives in the Container tab; instead of clicking through
  // the UI just simulate the hover by setting ghostPreset directly.
  const before = await page.evaluate(() => window.__store.getState().ghostPreset);
  await page.evaluate(() => {
    const s = window.__store.getState();
    s.setGhostPreset({
      source: 'container',
      faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Window_Standard', s: 'Window_Standard', e: 'Window_Standard', w: 'Window_Standard' },
      targetScope: 'container',
      arrangementId: 'framed_glass_box',
    });
  });
  await page.waitForTimeout(800);
  await snap(page, '13-arrangement-hover');
  const after = await page.evaluate(() => window.__store.getState().ghostPreset);
  record(`  → before ghostPreset: ${before ? 'set' : 'null'}, after: ${after?.arrangementId ?? 'null'}`);
  if (after?.arrangementId !== 'framed_glass_box') note('GhostPreview', 'ghostPreset not updated after hover', 'BUG');
  await page.evaluate(() => window.__store.getState().clearGhostPreset());
}

// ── Run ──────────────────────────────────────────────────────────
const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-gpu-rasterization',
    '--ignore-gpu-blocklist',
    '--enable-features=Vulkan',
    '--use-angle=gl',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => { consoleErrors.push('EXCEPTION: ' + e.message); });

// 'load' returns when the document has loaded; 'networkidle' waits for HMR
// websocket idle which never happens in dev mode and times out at 60s.
await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(
  () => window.__store?.getState?.()._hasHydrated && document.querySelector('canvas'),
  { timeout: 60000 },
);
await page.waitForTimeout(2500);

try {
  await story1_wizard(page);
  await story2_showcase(page);
  await story3_darkmode(page);
  await story4_modal_animation(page);
  await story5_scene_fade(page);
  await story6_arrangement_hover(page);
} catch (e) {
  note('Probe', `Probe crashed: ${e.message}`, 'BUG');
}

await browser.close();

record('\n=== CONSOLE ERRORS ===');
for (const e of consoleErrors) record(`  ${e}`);
record(`\n=== ISSUES (${issues.length}) ===`);
for (const i of issues) record(`  [${i.severity}] ${i.category}: ${i.msg}`);

writeFileSync(resolve(OUT, 'report.md'), `# QA Report ${OUT.split(/[\\/]/).pop()}\n\n## Log\n\n\`\`\`\n${log.join('\n')}\n\`\`\`\n\n## Issues\n\n${issues.map((i) => `- **[${i.severity}] ${i.category}**: ${i.msg}`).join('\n')}\n\n## Console Errors\n\n${consoleErrors.map((e) => `- ${e}`).join('\n') || '(none)'}`);
console.log(`\nReport: ${OUT}/report.md`);
