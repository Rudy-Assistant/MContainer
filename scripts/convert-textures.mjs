#!/usr/bin/env node
/**
 * KTX2 Texture Conversion Script
 *
 * Converts JPG/PNG textures in public/assets/materials/ to GPU-compressed KTX2
 * format in public/assets/materials-ktx2/ using the toktx CLI from KTX-Software.
 *
 * Usage:
 *   npm run convert-textures
 *
 * Prerequisites:
 *   Install KTX-Software: https://github.com/KhronosGroup/KTX-Software/releases
 *   Ensure `toktx` is on your PATH.
 *
 * Output mirrors the input directory structure:
 *   public/assets/materials/Corrugated_Steel/color.jpg
 *   → public/assets/materials-ktx2/Corrugated_Steel/color.ktx2
 */

import { execSync } from 'child_process';
import { readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { resolve, join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_DIR = resolve(__dirname, '../public/assets/materials');
const OUTPUT_DIR = resolve(__dirname, '../public/assets/materials-ktx2');

// ── Check prerequisites ──────────────────────────────────────

function checkToktx() {
  try {
    execSync('toktx --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!checkToktx()) {
  console.error('ERROR: toktx not found on PATH.');
  console.error('Install KTX-Software from: https://github.com/KhronosGroup/KTX-Software/releases');
  console.error('Then ensure toktx is available in your PATH.');
  process.exit(1);
}

if (!existsSync(INPUT_DIR)) {
  console.error(`ERROR: Input directory not found: ${INPUT_DIR}`);
  process.exit(1);
}

// ── Discover texture folders ─────────────────────────────────

const folders = readdirSync(INPUT_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

if (folders.length === 0) {
  console.log('No texture folders found. Nothing to convert.');
  process.exit(0);
}

console.log(`Found ${folders.length} texture folders to convert.\n`);

// ── Convert each folder ──────────────────────────────────────

let totalConverted = 0;
let totalSkipped = 0;
let totalFailed = 0;

for (const folder of folders) {
  const inputPath = join(INPUT_DIR, folder);
  const outputPath = join(OUTPUT_DIR, folder);

  const files = readdirSync(inputPath)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .filter(f => {
      // Skip files that are clearly not textures (thumbs, etc.)
      const stats = statSync(join(inputPath, f));
      return stats.size > 1024; // Skip files < 1KB
    });

  if (files.length === 0) {
    console.log(`  ${folder}/: no texture files, skipping`);
    continue;
  }

  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
  }

  console.log(`  ${folder}/: ${files.length} textures`);

  for (const file of files) {
    const input = join(inputPath, file);
    const outputFile = basename(file, extname(file)) + '.ktx2';
    const output = join(outputPath, outputFile);

    // Skip if output already exists and is newer than input
    if (existsSync(output)) {
      const inputMtime = statSync(input).mtimeMs;
      const outputMtime = statSync(output).mtimeMs;
      if (outputMtime > inputMtime) {
        totalSkipped++;
        continue;
      }
    }

    // Determine if this is a color texture (needs sRGB) or data texture (linear)
    const isColor = /color|diffuse|albedo|base/i.test(file);
    const colorSpace = isColor ? '--assign_oetf srgb' : '--assign_oetf linear';

    try {
      // ETC1S encoding: good compression ratio, fast decode, universal GPU support
      execSync(
        `toktx --encode etc1s --clevel 2 ${colorSpace} "${output}" "${input}"`,
        { stdio: 'pipe' }
      );
      totalConverted++;
      console.log(`    ✓ ${file} → ${outputFile}`);
    } catch (err) {
      totalFailed++;
      console.error(`    ✗ ${file} — conversion failed: ${err.message}`);
    }
  }
}

// ── Summary ──────────────────────────────────────────────────

console.log(`\nDone! ${totalConverted} converted, ${totalSkipped} skipped (up-to-date), ${totalFailed} failed.`);
if (totalConverted > 0) {
  console.log(`KTX2 files written to: ${OUTPUT_DIR}`);
}
