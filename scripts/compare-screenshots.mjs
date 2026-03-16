/**
 * Pixel comparison utility for visual gates.
 *
 * Usage:
 *   import { compareToBaseline } from './compare-screenshots.mjs';
 *   const result = compareToBaseline(screenshotBuffer, baselinePath, diffPath, threshold);
 */
import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * Compare a screenshot buffer to a baseline PNG file.
 * @param {Buffer} screenshotBuffer - PNG buffer from Playwright screenshot
 * @param {string} baselinePath - Path to baseline PNG
 * @param {string} diffPath - Path to write diff PNG on mismatch
 * @param {number} [threshold=0.02] - Max allowed diff percentage (0-1)
 * @returns {{ match: boolean, diffPercent: number, diffPixels: number, totalPixels: number }}
 */
export function compareToBaseline(screenshotBuffer, baselinePath, diffPath, threshold = 0.02) {
  const baseline = PNG.sync.read(readFileSync(baselinePath));
  const screenshot = PNG.sync.read(screenshotBuffer);

  // Resize check
  if (baseline.width !== screenshot.width || baseline.height !== screenshot.height) {
    return {
      match: false,
      diffPercent: 1.0,
      diffPixels: baseline.width * baseline.height,
      totalPixels: baseline.width * baseline.height,
      error: `Size mismatch: baseline ${baseline.width}x${baseline.height} vs screenshot ${screenshot.width}x${screenshot.height}`,
    };
  }

  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  const totalPixels = width * height;

  const diffPixels = pixelmatch(
    baseline.data,
    screenshot.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }  // pixelmatch per-pixel sensitivity
  );

  const diffPercent = diffPixels / totalPixels;
  const match = diffPercent <= threshold;

  if (!match) {
    writeFileSync(diffPath, PNG.sync.write(diff));
  }

  return { match, diffPercent, diffPixels, totalPixels };
}
