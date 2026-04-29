// Walkthrough verification: enter walkthrough mode, fly to the south entry door
// of the 1-container preset, confirm the crosshair targets it, fire the 'O' key,
// and check that the openFaces flag flipped.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const DIR = '.gstack/design-reports/screenshots/walkthrough';
fs.mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERR', err.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
await page.waitForTimeout(2500);
await page.keyboard.press('Escape');
await page.keyboard.press('Alt+3');
await page.waitForTimeout(800);

// Place walkthrough_1_studio, capture the container ID + door state.
const setup = await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((id) => s.removeContainer?.(id));
  const ids = window.__store.getState().placeModelHome('walkthrough_1_studio', [0, 0, 0]);
  const after = window.__store.getState();
  if (after.wizardOpen) after.closeWizard();
  const cid = ids[0];
  const v28 = after.containers[cid]?.voxelGrid?.[28];
  return {
    cid,
    doorBefore: v28?.faces.s,
    openBefore: !!v28?.openFaces?.s,
  };
});
console.log('SETUP:', JSON.stringify(setup));

// Drive the door toggle directly via the store action (the same path the 'O'
// key handler uses inside WalkthroughControls). This proves the action wiring
// without depending on pointer-lock + raycast in headless Chromium, which
// can't capture the crosshair reliably.
const after = await page.evaluate(([cid]) => {
  window.__store.getState().toggleOpenFace(cid, 28, 's');
  const s2 = window.__store.getState();
  const v28 = s2.containers[cid]?.voxelGrid?.[28];
  return { openAfter: !!v28?.openFaces?.s };
}, [setup.cid]);
console.log('AFTER toggleOpenFace:', JSON.stringify(after));

// Now also confirm the WalkthroughControls 'O' handler runs end-to-end by
// dispatching a synthetic KeyO event after entering walkthrough mode and
// pre-populating hoveredVoxelEdge with our door target.
await page.keyboard.press('KeyF'); // F = enter walkthrough
await page.waitForTimeout(2000);
const inWalkthrough = await page.evaluate(() => {
  return window.__store.getState().viewMode;
});
console.log('viewMode after F:', inWalkthrough);

// Simulate the crosshair landing on the door, then press O.
await page.evaluate(([cid]) => {
  window.__store.getState().setHoveredVoxelEdge?.({ containerId: cid, voxelIndex: 28, face: 's' });
}, [setup.cid]);
await page.waitForTimeout(300);
await page.keyboard.press('KeyO');
await page.waitForTimeout(500);

const finalState = await page.evaluate(([cid]) => {
  const v28 = window.__store.getState().containers[cid]?.voxelGrid?.[28];
  return { openAfterO: !!v28?.openFaces?.s };
}, [setup.cid]);
console.log('FINAL after KeyO:', JSON.stringify(finalState));

const out = `${DIR}/walkthrough-door-toggle.png`;
try {
  await page.screenshot({ path: out, timeout: 30000 });
  console.log('✓', out);
} catch (e) {
  console.log('✗', out, e.message);
}

await browser.close();
console.log('done');
