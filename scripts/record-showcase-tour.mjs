/**
 * record-showcase-tour.mjs — Drive the Glass Atrium Showcase through a
 * scripted exterior tour and record the result as WebM video.
 *
 * Run:
 *   1. npm run dev                              (in one terminal)
 *   2. node scripts/record-showcase-tour.mjs    (in another)
 *
 * Output: ./gate-baselines/showcase-tour-<timestamp>.webm   (trimmed)
 *         ./gate-baselines/vframes-<timestamp>/             (sampled QA frames)
 *
 * Why exterior only:
 *   Earlier attempts tried to script an interior walk-through. The auto-tour
 *   waypoint generator doesn't cope with this 8-container layout (camera
 *   ends up inside glass walls / atrium voids — produces black frames).
 *   A scripted interior path runs the same risk for any future preset
 *   change. Exterior orbit + close-up + sunset + rooftop reveal tells the
 *   showcase's story (atrium visible from above, framed glass, rooftop deck)
 *   without any chance of camera-in-wall artefacts.
 *
 * Output is post-processed: the first ~5s of the WebM (app loading + wizard
 * dismiss) is trimmed in a single ffmpeg-or-cv2 pass at the end.
 */

import { chromium } from 'playwright';
import { mkdirSync, readdirSync, renameSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT_DIR = resolve('gate-baselines');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const RAW_NAME = `_raw-${STAMP}.webm`;
const FINAL_NAME = `showcase-tour-${STAMP}.webm`;
const FRAMES_DIR = resolve('gate-baselines', `vframes-${STAMP}`);

mkdirSync(OUT_DIR, { recursive: true });

// CSS that hides every UI overlay so only the WebGL canvas shows.
// `header` is the TopToolbar (verified via DOM probe).
// The walkthrough crosshair + instructions live in absolutely-positioned
// divs but we don't enter walkthrough this take — leaving those rules in
// for safety in case future revisions add walkthrough back.
const RECORDING_CSS = `
  header { display: none !important; }
  /* Walkthrough HUD (defensive — not used in this take) */
  .absolute.inset-0.pointer-events-none.flex.items-center.justify-center.z-30 { display: none !important; }
  .absolute.bottom-4.left-1\\/2.-translate-x-1\\/2.z-30 { display: none !important; }
  /* Sonner toasts */
  [data-sonner-toaster] { display: none !important; }
  /* Sidebar collapsed strip */
  [data-testid="sidebar-collapsed"] { display: none !important; }
  /* Face-filter cube widget in the lower-left */
  div[title*="Face filter"] { display: none !important; }
  /* Compass widget — drei's GizmoHelper in lower-right.
     The compass div has labels "UP", "N", "S", "E", "W" — target by the
     drei wrapper class. Use a broad attribute hide as fallback. */
  [class*="GizmoHelper"], [data-gizmo], div[style*="position: absolute"][style*="bottom"][style*="right"] {
    display: none !important;
  }
  /* Level slicer widget in upper-right ("All ▼" pill button) */
  button[title*="Level"], div[title*="Level"] { display: none !important; }
`;

async function setStore(page, mutator, ...args) { return page.evaluate(mutator, ...args); }

async function moveCamera(page, pos, target, smooth = false) {
  await page.evaluate(
    ({ p, t, sm }) => {
      const cc = window.__cameraControls;
      if (!cc) return;
      cc.setPosition(p[0], p[1], p[2], sm);
      cc.setTarget(t[0], t[1], t[2], sm);
    },
    { p: pos, t: target, sm: smooth },
  );
}

async function waitForReady(page) {
  await page.waitForFunction(() => typeof window.__store !== 'undefined', { timeout: 30_000 });
  await page.waitForFunction(
    () => {
      const s = window.__store?.getState?.();
      const canvas = document.querySelector('canvas');
      return s?._hasHydrated && canvas && canvas.width > 0 && canvas.height > 0;
    },
    { timeout: 30_000 },
  );
  await page.waitForTimeout(2000);
}

async function run() {
  console.log(`[record] → ${FINAL_NAME}`);

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
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.warn(`[page exception] ${err.message}`));

  // Wall-clock timestamp of when video recording effectively started.
  // Playwright begins recording on page creation, so this is "as close as
  // we can measure" — used by the trimmer to compute a precise lead-in cut.
  const recordStartMs = Date.now();

  console.log('[record] Loading...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90_000 });
  await waitForReady(page);

  // Hide all chrome immediately
  await page.addStyleTag({ content: RECORDING_CSS });

  // Close wizard + place showcase + sanitize state
  console.log('[record] Placing...');
  await setStore(page, () => {
    const s = window.__store.getState();
    if (s.wizardOpen) s.closeWizard();
    Object.keys(s.containers).forEach((id) => s.removeContainer(id));
    s.clearSelection();
    s.setSelectedElements(null);
    s.setSelectedFace(null);
    if (s.showHotbar) s.toggleHotbar();
    if (!s.collapsed) s.toggleSidebar();
    s.placeModelHome('glass_atrium_showcase');
    s.setTimeOfDay(11);
    s.setSiteContextEnabled(true);
    s.clearSelection();
    s.setSelectedElements(null);
    s.setSelectedFace(null);
  });
  await page.waitForFunction(
    () => Object.keys(window.__store.getState().containers).length === 8,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(2500); // smart rules + animations settle

  // Open the south sliding doors
  await setStore(page, () => {
    const s = window.__store.getState();
    const l1 = Object.entries(s.containers)
      .filter(([, c]) => c.position.y === 0)
      .map(([id, c]) => ({ id, x: c.position.x, z: c.position.z }));
    const maxZ = Math.max(...l1.map((c) => c.z));
    const south = l1.filter((c) => Math.abs(c.z - maxZ) < 0.1).sort((a, b) => a.x - b.x);
    [27, 28, 11, 12].forEach((idx) => {
      south.forEach(({ id }) => {
        try { s.toggleOpenFace(id, idx, 's'); } catch { /* ignore */ }
      });
    });
  });
  await page.waitForTimeout(800);

  // ── Building bounds (verified via probe) ──
  // X [-6.1, 18.3], Y [0, 5.8], Z [-1.22, 3.66]; centre (6.1, 2.9, 1.22)
  const C = { x: 6.1, y: 2.9, z: 1.22 };

  // Wall-clock at the moment "real" content starts being filmed. We trim
  // everything before this from the final video.
  const realStartMs = Date.now();
  const leadInSeconds = Math.max(0, (realStartMs - recordStartMs) / 1000);
  console.log(`[trim] lead-in = ${leadInSeconds.toFixed(1)}s`);

  // ── 1. Hero orbit — 360° around the building (12s) ─────────
  console.log('[record] 360° orbit...');
  const ORBIT_STEPS = 60;
  const ORBIT_R = 24;
  const ORBIT_H = 12;
  for (let i = 0; i < ORBIT_STEPS; i++) {
    const a = (i / ORBIT_STEPS) * Math.PI * 2;
    const x = C.x + ORBIT_R * Math.cos(a);
    const z = C.z + ORBIT_R * Math.sin(a);
    await moveCamera(page, [x, ORBIT_H, z], [C.x, C.y, C.z], false);
    await page.waitForTimeout(180);
  }

  // ── 2. Close-up sweep along the south face (4s) ─────────────
  // Lower camera Y + closer target Y so building dominates the frame;
  // earlier framing wasted half the shot on sky.
  console.log('[record] South close-up sweep...');
  await moveCamera(page, [C.x - 8, 3, C.z + 14], [C.x - 4, 2.5, C.z], true);
  await page.waitForTimeout(2000);
  await moveCamera(page, [C.x + 8, 3, C.z + 14], [C.x + 4, 2.5, C.z], true);
  await page.waitForTimeout(2500);

  // ── 3. Angled aerial showing the atrium void (4s) ───────────
  // Earlier take used a straight-down angle which gave moiré on the
  // roof texture and didn't reveal the atrium void. 45° elevation
  // shows the framed-glass envelope + the atrium opening + the
  // rooftop deck all in one frame.
  console.log('[record] Angled aerial...');
  await moveCamera(page, [C.x + 14, 11, C.z - 14], [C.x, 4, C.z], true);
  await page.waitForTimeout(2000);
  await moveCamera(page, [C.x - 14, 11, C.z - 14], [C.x, 4, C.z], true);
  await page.waitForTimeout(2500);

  // ── 4. Sunset ramp — gradual lighting change (3s) ───────────
  console.log('[record] Sunset...');
  // Smooth golden-hour transition. 11h → 17h (NOT 18.5h — that goes too dark).
  for (let s = 1; s <= 18; s++) {
    const t = 11 + (17 - 11) * (s / 18);
    await setStore(page, (todValue) => {
      window.__store.getState().setTimeOfDay(todValue);
    }, t);
    await page.waitForTimeout(170);
  }

  // ── 5. Rooftop reveal — angled hero shot at sunset (5s) ────
  console.log('[record] Rooftop reveal...');
  await moveCamera(page, [C.x + 18, 9, C.z - 14], [C.x, 4, C.z], true);
  await page.waitForTimeout(2500);
  // Slow pull back to final framing
  await moveCamera(page, [C.x + 22, 11, C.z - 18], [C.x, 3, C.z], true);
  await page.waitForTimeout(2500);

  console.log('[record] Closing + saving video...');
  // Use Playwright's video API to ensure the file is fully flushed BEFORE
  // we touch it. Bare context.close() returns before the WebM finishes
  // writing, which produces 0-byte files when read immediately after.
  const video = page.video();
  await page.close();
  const rawPath = resolve(OUT_DIR, RAW_NAME);
  if (video) {
    await video.saveAs(rawPath);
    await video.delete();
  }
  await context.close();
  await browser.close();

  // Sanity-check the raw video has bytes
  if (!video) {
    console.error('[record] ✗ page.video() returned null');
    process.exit(1);
  }

  // Trim is now wall-clock measured: cut everything from recording start
  // until "real content begins" plus a 0.5s safety margin so the first
  // frame is mid-orbit, not the static placement-just-finished moment.
  const TRIM_SECONDS = leadInSeconds + 0.5;
  console.log(`[record] Trimming first ${TRIM_SECONDS}s...`);
  const finalPath = resolve(OUT_DIR, FINAL_NAME);
  const trimScript = `
import cv2
v = cv2.VideoCapture(r'${rawPath.replace(/\\/g, '\\\\')}')
fps = v.get(cv2.CAP_PROP_FPS)
total = int(v.get(cv2.CAP_PROP_FRAME_COUNT))
w = int(v.get(cv2.CAP_PROP_FRAME_WIDTH))
h = int(v.get(cv2.CAP_PROP_FRAME_HEIGHT))
print(f'raw: fps={fps:.2f} frames={total} duration={total/fps:.1f}s {w}x{h}')
start_frame = int(${TRIM_SECONDS} * fps)
fourcc = cv2.VideoWriter_fourcc(*'VP80')
out = cv2.VideoWriter(r'${finalPath.replace(/\\/g, '\\\\')}', fourcc, fps, (w, h))
v.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
written = 0
while True:
    ok, f = v.read()
    if not ok:
        break
    out.write(f)
    written += 1
out.release(); v.release()
print(f'trimmed: {written} frames written, duration={written/fps:.1f}s')
`;
  const trim = spawnSync('python', ['-c', trimScript], { stdio: 'inherit' });
  if (trim.status !== 0) {
    console.warn('[record] trim failed; keeping raw video');
    renameSync(rawPath, finalPath);
  } else {
    try { unlinkSync(rawPath); } catch { /* ignore */ }
  }
  console.log(`[record] ✓ Video: ${finalPath}`);

  // Sample 8 frames from the FINAL trimmed video for self-verification
  console.log('[record] Sampling QA frames...');
  mkdirSync(FRAMES_DIR, { recursive: true });
  const sampleScript = `
import cv2
v = cv2.VideoCapture(r'${finalPath.replace(/\\/g, '\\\\')}')
fps = v.get(cv2.CAP_PROP_FPS)
total = int(v.get(cv2.CAP_PROP_FRAME_COUNT))
print(f'final: duration={total/fps:.1f}s frames={total}')
for i in range(8):
    pos = int(total * (i + 0.5) / 8)
    v.set(cv2.CAP_PROP_POS_FRAMES, pos)
    ok, f = v.read()
    if ok:
        cv2.imwrite(r'${FRAMES_DIR.replace(/\\/g, '\\\\')}' + f'/qa_{i:02d}_t{pos/fps:.0f}s.png', f)
v.release()
`;
  spawnSync('python', ['-c', sampleScript], { stdio: 'inherit' });
  console.log(`[record] ✓ Frames: ${FRAMES_DIR}/`);
}

run().catch((err) => {
  console.error('[record] Failed:', err);
  process.exit(1);
});
