/**
 * Focused debug probe for the 3 findings from probe-user-stories.mjs.
 * For each finding, gather evidence about what's actually happening
 * before proposing any fix.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--use-angle=gl', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.warn('[ex]', e.message));
await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(
  () => window.__store?.getState?.()._hasHydrated && document.querySelector('canvas'),
  { timeout: 60000 },
);
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const s = window.__store.getState();
  if (s.wizardOpen) s.closeWizard();
  Object.keys(s.containers).forEach((id) => s.removeContainer(id));
});
await page.waitForTimeout(500);

console.log('\n========== FINDING 1: appliedPreset for Glass Box wizard ==========');
// What does applyWizardPreset actually set?
await page.evaluate(() => {
  const s = window.__store.getState();
  const id = s.addContainer();
  s.applyWizardPreset(id, 'glass_box');
});
await page.waitForTimeout(800);
const ap = await page.evaluate(() => {
  const s = window.__store.getState();
  const c = Object.values(s.containers)[0];
  return {
    appliedPreset: c?.appliedPreset,
    applied_preset_type: typeof c?.appliedPreset,
    voxel_count: c?.voxelGrid?.length,
    sample_face: c?.voxelGrid?.[10]?.faces,
  };
});
console.log(JSON.stringify(ap, null, 2));
console.log('→ Glass Box wizard preset HAS designIntent.arrangementId="largest_glass"');
console.log('→ But appliedPreset is set to wizard-preset id "glass_box" instead.');
console.log('→ Question: is "glass_box" a valid ContainerArrangementId?');
const isValid = await page.evaluate(() => {
  // CONTAINER_ARRANGEMENT_IDS is defined in types/container.ts
  // We can't import it here; check by trying to apply it
  const s = window.__store.getState();
  const id = Object.keys(s.containers)[0];
  try {
    s.applyContainerArrangement(id, 'glass_box');
    return 'no error';
  } catch (e) { return 'ERROR: ' + e.message; }
});
console.log('→ applyContainerArrangement("glass_box"):', isValid);

await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((id) => s.removeContainer(id));
});

console.log('\n========== FINDING 2: Library tab - is showcase findable? ==========');
// First, what tabs/buttons does the sidebar have?
const sidebarInfo = await page.evaluate(() => {
  const sidebar = document.querySelector('[data-testid="sidebar-expanded"]');
  if (!sidebar) return { error: 'sidebar not visible' };
  const tabs = Array.from(sidebar.querySelectorAll('button')).slice(0, 20).map((b) => ({
    text: b.textContent?.trim().slice(0, 30),
    testid: b.getAttribute('data-testid'),
  }));
  return { tabs };
});
console.log('Sidebar tabs/buttons (first 20):');
console.log(JSON.stringify(sidebarInfo, null, 2));

// What does activeTab look like in store?
const activeTabInfo = await page.evaluate(() => {
  const s = window.__store.getState();
  const keys = Object.keys(s).filter((k) => k.toLowerCase().includes('tab') || k.toLowerCase().includes('library') || k.toLowerCase().includes('saved'));
  return keys.reduce((acc, k) => { acc[k] = typeof s[k] === 'function' ? 'fn' : s[k]; return acc; }, {});
});
console.log('Store keys related to tabs/library/saved:', JSON.stringify(activeTabInfo, null, 2));

console.log('\n========== FINDING 3: scene-fade on Reset Canvas ==========');
await page.evaluate(() => {
  const s = window.__store.getState();
  s.placeModelHome('glass_atrium_showcase');
});
await page.waitForFunction(
  () => Object.keys(window.__store.getState().containers).length === 8,
  { timeout: 15000 },
);
await page.waitForTimeout(2500);

await page.evaluate(() => { window.confirm = () => true; });
console.log('Settings dropdown open?', await page.evaluate(() => !!document.querySelector('.dropdown-menu')));
const settingsClick = await page.evaluate(() => {
  const btn = document.querySelector('button[title="Settings"]');
  if (!btn) return 'btn not found';
  btn.click();
  return 'clicked';
});
console.log('Settings click:', settingsClick);
await page.waitForTimeout(300);
console.log('Dropdown after click?', await page.evaluate(() => {
  const dd = document.querySelector('.dropdown-menu');
  return dd ? { state: dd.getAttribute('data-state'), opacity: getComputedStyle(dd).opacity } : null;
}));

const btnReset = await page.evaluate(() => {
  const b = document.querySelector('[data-testid="btn-reset"]');
  return b ? { found: true, disabled: b.disabled, text: b.textContent?.trim() } : { found: false };
});
console.log('btn-reset:', JSON.stringify(btnReset));

// Snapshot sceneFadeActive BEFORE click
const beforeReset = await page.evaluate(() => window.__store.getState().sceneFadeActive);
console.log('sceneFadeActive BEFORE click:', beforeReset);

// Click via trustworthy path
const clickResult = await page.evaluate(() => {
  const b = document.querySelector('[data-testid="btn-reset"]');
  if (!b) return 'no btn';
  b.click();
  return 'clicked';
});
console.log('btn-reset click:', clickResult);

// Sample over 600ms
const timeline = [];
for (const dt of [10, 50, 100, 200, 300, 500]) {
  await page.waitForTimeout(dt);
  const sample = await page.evaluate(() => {
    const s = window.__store.getState();
    const o = document.querySelector('.scene-fade-overlay');
    return {
      sceneFadeActive: s.sceneFadeActive,
      containerCount: Object.keys(s.containers).length,
      overlayClass: o?.className,
      overlayOpacity: o ? getComputedStyle(o).opacity : null,
    };
  });
  timeline.push({ at: timeline.length === 0 ? dt : timeline[timeline.length - 1].at + dt, ...sample });
}
console.log('Timeline:');
for (const t of timeline) console.log(`  t=+${t.at}ms`, JSON.stringify(t));

// Independently test that triggerSceneFade alone WORKS — establishes that
// the fade infra is intact and the bug is in the Reset Canvas wiring.
console.log('\n--- Direct triggerSceneFade test ---');
await page.evaluate(() => window.__store.getState().triggerSceneFade());
await page.waitForTimeout(150);
const afterDirect = await page.evaluate(() => {
  const o = document.querySelector('.scene-fade-overlay');
  const s = window.__store.getState();
  return {
    sceneFadeActive: s.sceneFadeActive,
    overlayOpacity: o ? getComputedStyle(o).opacity : null,
  };
});
console.log('After direct triggerSceneFade:', JSON.stringify(afterDirect));

await browser.close();
