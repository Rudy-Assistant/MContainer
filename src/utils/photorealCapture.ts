/**
 * photorealCapture.ts — Render a high-resolution still of the current scene.
 *
 * Strategy:
 * 1. Save the user's current quality preset.
 * 2. Switch to 'photoreal' (max settings).
 * 3. Bump the renderer's pixel ratio to 2× the device default.
 * 4. Wait two animation frames for materials/env to settle.
 * 5. Capture canvas → PNG blob → download (or hand back as a data URL for
 *    preview).
 * 6. Restore both pixel ratio and quality preset.
 *
 * The renderer instance is exposed by DevSceneExpose at `window.__threeRenderer`.
 */

import { useStore } from '@/store/useStore';
import { downloadBlob } from '@/utils/downloadBlob';
import type { QualityPresetId } from '@/config/qualityPresets';

// __threeRenderer is declared as THREE.WebGLRenderer in DevSceneExpose; we
// just use the public methods via a structural cast.

interface CaptureOptions {
  /** Pixel ratio multiplier applied during capture. Default 2 (Retina). */
  pixelRatioMultiplier?: number;
  /** Frames to wait for the higher-quality preset to settle. Default 2. */
  settleFrames?: number;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Capture a high-res PNG of the current viewport. Returns a Blob, or null
 *  if the renderer is not yet available. */
export async function capturePhotoreal(opts: CaptureOptions = {}): Promise<Blob | null> {
  if (typeof window === 'undefined') return null;
  const renderer = window.__threeRenderer;
  if (!renderer?.domElement) return null;

  const { pixelRatioMultiplier = 2, settleFrames = 2 } = opts;
  const store = useStore.getState();
  const previousQuality: QualityPresetId = store.qualityPreset ?? 'medium';
  const previousPixelRatio = renderer.getPixelRatio?.() ?? window.devicePixelRatio ?? 1;

  // Wrap the entire bump/capture/restore in try/finally so the user is
  // never stranded at 2× pixel ratio + photoreal preset if anything throws.
  try {
    if (previousQuality !== 'photoreal') {
      store.setQualityPreset?.('photoreal');
    }
    if (renderer.setPixelRatio) {
      renderer.setPixelRatio(previousPixelRatio * pixelRatioMultiplier);
    }
    for (let i = 0; i < settleFrames; i++) await nextFrame();
    const blob: Blob | null = await new Promise((resolve) => {
      renderer.domElement.toBlob((b) => resolve(b), 'image/png', 1.0);
    });
    return blob;
  } finally {
    if (renderer.setPixelRatio) renderer.setPixelRatio(previousPixelRatio);
    if (previousQuality !== 'photoreal') {
      store.setQualityPreset?.(previousQuality);
    }
  }
}

/** Capture + download as a PNG file. */
export async function downloadPhotorealPNG(filename = `moduhome-photoreal-${new Date().toISOString().slice(0, 10)}.png`): Promise<void> {
  const blob = await capturePhotoreal();
  if (!blob) {
    alert('Photoreal capture failed — renderer not ready yet. Try again in a moment.');
    return;
  }
  downloadBlob(blob, filename);
}
