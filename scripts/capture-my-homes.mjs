import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/');
await p.waitForFunction(() => window.__store && window.__store.getState()._hasHydrated, { timeout: 30000 });
const cancel = p.locator('button', { hasText: 'Cancel' }).first();
if (await cancel.count()) await cancel.click({ force: true }).catch(() => {});
await p.evaluate(() => {
  const s = window.__store.getState();
  if (Object.keys(s.containers).length === 0) {
    s.addContainer('40ft_high_cube', { x: 0, y: 0, z: 0 }, 0);
  }
  const hasResort = s.libraryHomeDesigns.some((d) => d.label.includes('Resort House'));
  if (!hasResort) {
    s.saveHomeDesign('Resort House Atrium (manual)');
  }
});
await p.waitForTimeout(800);

const savedTab = p.locator('button').filter({ hasText: /^Saved$/ }).first();
await savedTab.click({ force: true });
await p.waitForTimeout(500);

// Find the "My Homes" section label and scroll it into view
const myHomes = p.locator('text=My Homes').first();
if (await myHomes.count()) {
  await myHomes.scrollIntoViewIfNeeded();
  await p.waitForTimeout(400);
  console.log('My Homes label found and scrolled into view');
} else {
  console.log('SHORTFALL: "My Homes" label not found in DOM');
}

await p.screenshot({ path: '.qa/manual-resort/11-my-homes-section.png' });

const state = await p.evaluate(() => {
  const designs = window.__store.getState().libraryHomeDesigns;
  return {
    count: designs.length,
    items: designs.map((d) => ({ label: d.label, containers: d.containers?.length, id: d.id?.slice(0, 8) })),
  };
});
console.log(JSON.stringify(state, null, 2));

await b.close();
