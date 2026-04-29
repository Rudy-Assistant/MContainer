/**
 * perf-baseline.mjs — Full-kitchen scene FPS baseline.
 *
 * Sets up an 8-cabinet + counter-run + appliance-loaded kitchen using the
 * shipped room preset, then samples frame timings during a 5-second
 * walkthrough. Reports avg + p95 frame time.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = '.gstack/design-reports/perf-baseline.json';
fs.mkdirSync('.gstack/design-reports', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (err) => console.log('PAGE ERR:', err.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => typeof window.__store === 'function', { timeout: 120000 });
await page.waitForTimeout(2500);

await page.evaluate(() => {
  const s = window.__store.getState();
  Object.keys(s.containers).forEach((cid) => s.removeContainer?.(cid));
  if (s.wizardOpen) s.closeWizard();
  // Place a 40' HC, then the open-plan kitchen+living+dining preset
  // (4 cols × 2 rows = 8 voxels filled with cabinets, fixtures, furniture).
  const cid = window.__store.getState().addContainer('40HC', { x: 0, y: 0, z: 0 });
  // Activate body voxels first
  for (let r = 1; r <= 2; r++) for (let c = 1; c <= 6; c++) {
    window.__store.getState().setVoxelActive?.(cid, r * 8 + c, true);
  }
  window.__store.getState().applyRoomPreset(cid, 0, 0, 'open_plan_klr');
  window.__store.getState().applyRoomPreset(cid, 4, 0, 'living_room');
});
await page.waitForTimeout(2500);

// Sample frame timings for 5 seconds via requestAnimationFrame
const samples = await page.evaluate(() => {
  return new Promise((resolve) => {
    const times = [];
    let last = performance.now();
    const start = last;
    const tick = (now) => {
      const dt = now - last;
      last = now;
      if (dt > 0 && dt < 1000) times.push(dt);
      if (now - start < 5000) requestAnimationFrame(tick);
      else resolve(times);
    };
    requestAnimationFrame(tick);
  });
});

const sorted = [...samples].sort((a, b) => a - b);
const avg = samples.reduce((s, x) => s + x, 0) / samples.length;
const p50 = sorted[Math.floor(sorted.length * 0.5)];
const p95 = sorted[Math.floor(sorted.length * 0.95)];
const p99 = sorted[Math.floor(sorted.length * 0.99)];
const fps = 1000 / avg;

const result = {
  scene: 'open_plan_klr + living_room (40\' HC, 8 body voxels populated)',
  capturedAt: new Date().toISOString(),
  samples: samples.length,
  avgFrameMs: Number(avg.toFixed(2)),
  p50FrameMs: Number(p50.toFixed(2)),
  p95FrameMs: Number(p95.toFixed(2)),
  p99FrameMs: Number(p99.toFixed(2)),
  avgFPS: Number(fps.toFixed(1)),
  passed60fps: avg < 17,
  passed30fps: avg < 34,
};
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
console.log(`Wrote ${OUT}`);

await browser.close();
