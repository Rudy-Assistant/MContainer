import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const BASE_URL = process.env.MCONTAINER_BASE_URL || 'http://localhost:3000';
const OUT_DIR = path.resolve('gate-screenshots', 'lighting');
const REPORT_PATH = path.resolve('GATE-LIGHTING-REPORT.json');

const CASES = [
  { name: 'morning-glass-atrium', time: 8, arrangement: 'glass_atrium' },
  { name: 'midday-glass-atrium', time: 15, arrangement: 'glass_atrium' },
  { name: 'golden-roof-terrace', time: 17.5, arrangement: 'roof_terrace' },
  { name: 'dusk-roof-terrace', time: 19.25, arrangement: 'roof_terrace' },
];

function analyzeSky(buffer) {
  const png = PNG.sync.read(buffer);
  const samples = new Map();
  let white = 0;
  let dark = 0;
  const skyRows = Math.max(1, Math.floor(png.height * 0.28));
  for (let y = 0; y < skyRows; y += 3) {
    for (let x = 0; x < png.width; x += 3) {
      const i = (png.width * y + x) << 2;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      samples.set(`${r >> 4},${g >> 4},${b >> 4}`, (samples.get(`${r >> 4},${g >> 4},${b >> 4}`) || 0) + 1);
      if (r > 238 && g > 238 && b > 238) white++;
      if (r < 10 && g < 10 && b < 10) dark++;
    }
  }
  const total = [...samples.values()].reduce((sum, count) => sum + count, 0);
  return {
    skyBuckets: samples.size,
    whiteRatio: Number((white / Math.max(total, 1)).toFixed(3)),
    darkRatio: Number((dark / Math.max(total, 1)).toFixed(3)),
  };
}

async function waitForStore(page) {
  await page.waitForFunction(() => !!window.__store?.getState, null, { timeout: 30000 });
}

async function focusCamera(page) {
  await page.waitForFunction(() => !!window.__cameraControls || !!window.__camera, null, { timeout: 5000 }).catch(() => null);
  await page.evaluate(async () => {
    const containers = Object.values(window.__store?.getState?.().containers ?? {});
    const center = containers.length
      ? containers.reduce((acc, container) => ({
          x: acc.x + container.position.x,
          y: acc.y + container.position.y,
          z: acc.z + container.position.z,
        }), { x: 0, y: 0, z: 0 })
      : { x: 0, y: 0, z: 0 };
    const cx = containers.length ? center.x / containers.length : 0;
    const cy = containers.length ? center.y / containers.length + 1.6 : 1.6;
    const cz = containers.length ? center.z / containers.length : 0;
    const span = Math.max(
      10,
      ...containers.map((container) => Math.hypot(container.position.x - cx, container.position.z - cz) + 10),
    );
    const px = cx + span;
    const py = cy + span * 0.45;
    const pz = cz + span;
    const controls = window.__cameraControls;
    if (controls) {
      const maybeLookAt = controls.setLookAt?.(px, py, pz, cx, cy, cz, false);
      if (maybeLookAt && typeof maybeLookAt.then === 'function') {
        await maybeLookAt;
      } else {
        const maybePosition = controls.setPosition?.(px, py, pz, false);
        if (maybePosition && typeof maybePosition.then === 'function') await maybePosition;
        const maybeTarget = controls.setTarget?.(cx, cy, cz, false);
        if (maybeTarget && typeof maybeTarget.then === 'function') await maybeTarget;
      }
    } else if (window.__camera) {
      window.__camera.position.set(px, py, pz);
      window.__camera.lookAt(cx, cy, cz);
      window.__camera.updateProjectionMatrix?.();
    }
    if (window.__threeRenderer && window.__scene && window.__camera) {
      window.__threeRenderer.render(window.__scene, window.__camera);
    }
  });
  await page.waitForTimeout(300);
}

async function setupCase(page, testCase) {
  await page.evaluate((input) => {
    const store = window.__store.getState();
    for (const id of Object.keys(store.containers)) store.removeContainer(id);
    const id = store.addContainer('40ft_high_cube', { x: 0, y: 0, z: 0 }, 0, true);
    store.select(id);
    store.applyContainerArrangement(id, input.arrangement);
    store.setTimeOfDay(input.time);
    store.setViewMode('3d');
    store.setViewLevel?.(null);
    store.setQualityPreset?.('low');
    return id;
  }, testCase);
}

async function capture(page, name) {
  await page.waitForFunction(() => document.querySelectorAll('canvas').length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(350);
  const box = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('canvas')]
      .map((canvas) => {
        const rect = canvas.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, area: rect.width * rect.height };
      })
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .sort((a, b) => b.area - a.area);
    return boxes[0] ?? null;
  });
  const clip = box
    ? {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      }
    : { x: 0, y: 70, width: 1600, height: 830 };
  const buffer = await page.screenshot({
    path: path.join(OUT_DIR, `${name}.png`),
    clip,
    timeout: 30000,
  });
  const metrics = analyzeSky(buffer);
  if (metrics.whiteRatio > 0.72) {
    throw new Error(`${name} sky is washed out: ${JSON.stringify(metrics)}`);
  }
  if (metrics.darkRatio > 0.92) {
    throw new Error(`${name} scene is mostly black: ${JSON.stringify(metrics)}`);
  }
  return metrics;
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  localStorage.setItem('moduhome-gpu-detected', 'true');
});
const results = [];

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForStore(page);

  for (const testCase of CASES) {
    console.log(`Running lighting gate: ${testCase.name}`);
    await setupCase(page, testCase);
    await focusCamera(page);
    const metrics = await capture(page, testCase.name);
    results.push({ ...testCase, status: 'pass', metrics });
  }
} finally {
  await browser.close();
}

writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL, results }, null, 2));
console.log(`Lighting visual matrix passed: ${results.length}`);
