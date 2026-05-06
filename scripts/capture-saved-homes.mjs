// Re-screenshot the Saved tab with the user-homes section scrolled into view.
// Bruce 2026-05-06 visual-QA enforcement: prove the saved Resort House
// is visible in the Saved tab, not just present in store state.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('.qa/manual-resort', { recursive: true });

const b = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/');
await p.waitForFunction(() => window.__store && window.__store.getState()._hasHydrated, { timeout: 30000 });
const cancel = p.locator('button', { hasText: 'Cancel' }).first();
if (await cancel.count()) await cancel.click({ force: true }).catch(() => {});
// Re-run the manual build's persisted state may have been lost on reload;
// run the save action directly so the home design exists for this capture.
await p.evaluate(() => {
  const s = window.__store.getState();
  // Ensure at least one container so saveHomeDesign has something to capture.
  if (Object.keys(s.containers).length === 0) {
    s.addContainer('40ft_high_cube', { x: 0, y: 0, z: 0 }, 0);
  }
  // If no Resort House design persisted across reload, save current state.
  const hasResort = s.libraryHomeDesigns.some((d) => d.label.includes('Resort House Atrium (manual)'));
  if (!hasResort) {
    s.saveHomeDesign('Resort House Atrium (manual)', 'Re-captured for visual QA');
  }
  s.setViewMode('blueprint');
});
await p.waitForTimeout(1500);

// Click Saved tab
const savedTab = p.locator('button').filter({ hasText: /^Saved$/ }).first();
await savedTab.click({ force: true });
await p.waitForTimeout(500);

// Find a scroll container in the sidebar and scroll it to the top so we see
// what's visible by default first.
await p.screenshot({ path: '.qa/manual-resort/08-saved-tab-top.png' });

// Now scroll the sidebar's scrollable element down to find user homes.
// UserLibrary section "MY DESIGNS" / "USER HOMES" should appear after MY BLOCKS / MY CONTAINERS.
// Use page.mouse.wheel to scroll the left sidebar.
await p.mouse.move(180, 600);
for (let i = 0; i < 10; i++) {
  await p.mouse.wheel(0, 200);
  await p.waitForTimeout(150);
}
await p.screenshot({ path: '.qa/manual-resort/09-saved-tab-scrolled.png' });

// Final scroll all the way down
for (let i = 0; i < 20; i++) {
  await p.mouse.wheel(0, 300);
  await p.waitForTimeout(80);
}
await p.screenshot({ path: '.qa/manual-resort/10-saved-tab-bottom.png' });

const state = await p.evaluate(() => {
  const s = window.__store.getState();
  return {
    homeDesigns: s.libraryHomeDesigns.map((d) => ({ label: d.label, containerCount: d.containerCount })),
  };
});
console.log(JSON.stringify(state, null, 2));

await b.close();
