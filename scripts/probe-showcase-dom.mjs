// Inspect the live DOM + the showcase's actual world-space bounds so the
// recording script targets correct CSS selectors and camera positions.
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 90_000 });
await page.waitForFunction(() => window.__store?.getState?.()._hasHydrated, { timeout: 30_000 });
await page.waitForTimeout(2500);

await page.evaluate(() => {
  const s = window.__store.getState();
  if (s.wizardOpen) s.closeWizard();
  Object.keys(s.containers).forEach((id) => s.removeContainer(id));
  s.placeModelHome('glass_atrium_showcase');
});
await page.waitForFunction(() => Object.keys(window.__store.getState().containers).length === 8, { timeout: 20_000 });
await page.waitForTimeout(2500);

const bounds = await page.evaluate(() => {
  const s = window.__store.getState();
  const C = Object.values(s.containers);
  let minX = Infinity, maxX = -Infinity, minY = 0, maxY = 0, minZ = Infinity, maxZ = -Infinity;
  for (const c of C) {
    const dim = { length: 12.19, width: 2.44, height: 2.90 };
    minX = Math.min(minX, c.position.x - dim.length / 2);
    maxX = Math.max(maxX, c.position.x + dim.length / 2);
    minY = Math.min(minY, c.position.y);
    maxY = Math.max(maxY, c.position.y + dim.height);
    minZ = Math.min(minZ, c.position.z - dim.width / 2);
    maxZ = Math.max(maxZ, c.position.z + dim.width / 2);
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
});
console.log('BOUNDS', JSON.stringify(bounds));

const ccPosition = await page.evaluate(() => {
  const cc = window.__cameraControls;
  if (!cc) return null;
  const p = cc.getPosition(new (window.THREE?.Vector3 || function(){})());
  const t = cc.getTarget(new (window.THREE?.Vector3 || function(){})());
  return { hasControls: !!cc, p: p ? [p.x, p.y, p.z] : null, t: t ? [t.x, t.y, t.z] : null };
});
console.log('CAM', JSON.stringify(ccPosition));

// Find TopToolbar selector
const toolbarInfo = await page.evaluate(() => {
  // Find element containing "Smart" + "Manual" buttons (top toolbar signature)
  const all = Array.from(document.querySelectorAll('button')).filter(b =>
    b.textContent?.trim() === 'Smart' || b.textContent?.trim() === 'Manual',
  );
  if (all.length === 0) return 'NO MATCH';
  const btn = all[0];
  // Walk up to find a sensible toolbar wrapper
  let el = btn;
  const path = [];
  while (el && el !== document.body) {
    path.push({ tag: el.tagName.toLowerCase(), cls: el.className?.slice?.(0, 80) ?? '', id: el.id });
    el = el.parentElement;
  }
  return path;
});
console.log('TOOLBAR_PATH', JSON.stringify(toolbarInfo, null, 2));

await browser.close();
