import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const BASE_URL = process.env.MCONTAINER_BASE_URL || 'http://localhost:3000';
const OUT_DIR = path.resolve('gate-screenshots', 'arrangements');
const REPORT_PATH = path.resolve('GATE-ARRANGEMENT-REPORT.json');

const ARRANGEMENTS = [
  'max_closed',
  'largest_glass',
  'central_atrium',
  'glass_atrium',
  'roof_terrace',
  'glass_terrace',
  'wraparound_deck',
  'wraparound_patio',
];

const MODELS = [
  'gallery_wings',
  'courtyard_compound',
  'stacked_atrium_tower',
];

function analyzePng(buffer) {
  const png = PNG.sync.read(buffer);
  const samples = new Map();
  let bright = 0;
  for (let y = 0; y < png.height; y += 4) {
    for (let x = 0; x < png.width; x += 4) {
      const i = (png.width * y + x) << 2;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      samples.set(key, (samples.get(key) || 0) + 1);
      if (r > 235 && g > 235 && b > 235) bright++;
    }
  }
  const total = [...samples.values()].reduce((sum, count) => sum + count, 0);
  const dominant = Math.max(...samples.values()) / Math.max(total, 1);
  return {
    uniqueBuckets: samples.size,
    dominantRatio: Number(dominant.toFixed(3)),
    brightRatio: Number((bright / Math.max(total, 1)).toFixed(3)),
  };
}

async function screenshotScene(page, name) {
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
  const metrics = analyzePng(buffer);
  if (metrics.uniqueBuckets < 24 || metrics.dominantRatio > 0.985) {
    throw new Error(`${name} screenshot appears blank or collapsed: ${JSON.stringify(metrics)}`);
  }
  return metrics;
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

async function resetToSingleContainer(page) {
  return page.evaluate(() => {
    const store = window.__store.getState();
    for (const id of Object.keys(store.containers)) store.removeContainer(id);
    const id = store.addContainer('40ft_high_cube', { x: 0, y: 0, z: 0 }, 0, true);
    store.select(id);
    store.setTimeOfDay(15);
    store.setViewMode('3d');
    store.setViewLevel?.(null);
    store.setQualityPreset?.('low');
    return id;
  });
}

function assertArrangement(summary) {
  if (summary.active <= 0) throw new Error(`${summary.arrangementId} has no active voxels`);
  if (summary.arrangementId.includes('glass') || summary.arrangementId === 'largest_glass') {
    if (summary.glassFaces < 12) throw new Error(`${summary.arrangementId} did not create enough glass faces`);
  }
  if (summary.arrangementId.includes('atrium')) {
    if (summary.openTop < 4 || summary.openBottomUpper < 4 || summary.railingFaces < 4) {
      throw new Error(`${summary.arrangementId} did not create guarded atrium openings`);
    }
  }
  if (summary.arrangementId.includes('terrace') || summary.arrangementId.includes('deck') || summary.arrangementId.includes('patio')) {
    if (summary.railingFaces < 8) throw new Error(`${summary.arrangementId} did not create a guarded outdoor perimeter`);
  }
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

  for (const arrangementId of ARRANGEMENTS) {
    console.log(`Running arrangement gate: ${arrangementId}`);
    const id = await resetToSingleContainer(page);
    const summary = await page.evaluate(({ id: containerId, arrangementId: target }) => {
      const store = window.__store.getState();
      store.applyContainerArrangement(containerId, target);
      const latest = window.__store.getState();
      const grid = latest.containers[containerId].voxelGrid || [];
      const active = grid.filter((voxel) => voxel.active).length;
      const faceValues = grid.flatMap((voxel) => Object.values(voxel.faces));
      const glassFaces = faceValues.filter((face) => face === 'Glass_Pane').length;
      const railingFaces = faceValues.filter((face) => face === 'Railing_Cable' || face === 'Railing_Glass').length;
      const openTop = grid.filter((voxel) => voxel.active && voxel.faces.top === 'Open').length;
      const openBottomUpper = grid.slice(32).filter((voxel) => voxel.active && voxel.faces.bottom === 'Open').length;
      return { arrangementId: target, active, glassFaces, railingFaces, openTop, openBottomUpper };
    }, { id, arrangementId });
    assertArrangement(summary);
    await focusCamera(page);
    const screenshot = await screenshotScene(page, arrangementId);
    results.push({ name: arrangementId, type: 'arrangement', status: 'pass', summary, screenshot });
  }

  for (const modelId of MODELS) {
    console.log(`Running model-home gate: ${modelId}`);
    await page.evaluate(() => {
      const store = window.__store.getState();
      for (const id of Object.keys(store.containers)) store.removeContainer(id);
      store.setViewLevel?.(null);
      store.setQualityPreset?.('low');
    });
    const placed = await page.evaluate((target) => window.__store.getState().placeModelHome(target), modelId);
    if (!Array.isArray(placed) || placed.length < 2) throw new Error(`${modelId} did not place a multi-container design`);
    await page.evaluate((firstId) => window.__store.getState().select(firstId), placed[0]);
    await page.waitForTimeout(1800);
    await focusCamera(page);
    const screenshot = await screenshotScene(page, modelId);
    results.push({ name: modelId, type: 'model-home', status: 'pass', placed: placed.length, screenshot });
  }
} finally {
  await browser.close();
}

writeFileSync(REPORT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL, results }, null, 2));
console.log(`Arrangement visual gates passed: ${results.length}`);
