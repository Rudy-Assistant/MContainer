#!/usr/bin/env node
/**
 * KTX2 Texture Conversion Script
 *
 * Converts 2K JPG/PNG textures to GPU-compressed KTX2 format.
 *
 * Usage:
 *   npm run convert-textures
 *   npm run convert-textures -- --source-suffix=-2k    (default)
 *   npm run convert-textures -- --source-suffix=""      (convert all textures)
 *
 * Codec strategy:
 *   - Normal maps → UASTC (lossless, precision-critical)
 *   - Color/roughness → ETC1S (lossy, small files)
 *
 * Prerequisites:
 *   Install KTX-Software: https://github.com/KhronosGroup/KTX-Software/releases
 *   Ensure `toktx` is on your PATH.
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

// Parse --source-suffix arg (default: '-2k')
const suffixArg = process.argv.find(a => a.startsWith('--source-suffix'));
const SOURCE_SUFFIX = suffixArg ? suffixArg.split('=')[1] ?? '-2k' : '-2k';

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

console.log(`Source suffix: "${SOURCE_SUFFIX}"`);
console.log(`Found ${folders.length} texture folders to scan.\n`);

// ── Convert each folder ──────────────────────────────────────

let totalConverted = 0;
let totalSkipped = 0;
let totalFailed = 0;

for (const folder of folders) {
  const inputPath = join(INPUT_DIR, folder);
  const outputPath = join(OUTPUT_DIR, folder);

  // Filter to files matching the source suffix
  const suffixPattern = SOURCE_SUFFIX
    ? new RegExp(`${SOURCE_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(jpg|jpeg|png)$`, 'i')
    : /\.(jpg|jpeg|png)$/i;

  const files = readdirSync(inputPath)
    .filter(f => suffixPattern.test(f))
    .filter(f => {
      const stats = statSync(join(inputPath, f));
      return stats.size > 1024;
    });

  if (files.length === 0) continue;

  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
  }

  console.log(`  ${folder}/: ${files.length} textures`);

  for (const file of files) {
    const input = join(inputPath, file);

    // Strip source suffix from output filename: color-2k.jpg → color.ktx2
    const baseName = basename(file, extname(file));
    const strippedName = SOURCE_SUFFIX ? baseName.replace(new RegExp(`${SOURCE_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '') : baseName;
    const outputFile = strippedName + '.ktx2';
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

    // Determine codec: normal maps get UASTC (lossless), others get ETC1S (lossy)
    const isNormal = /normal/i.test(file);
    const isColor = /color|diffuse|albedo|base/i.test(file);
    const colorSpace = isColor ? '--assign_oetf srgb' : '--assign_oetf linear';

    const encodeArgs = isNormal
      ? '--encode uastc --uastc_quality 2 --zstd 5'
      : '--encode etc1s --clevel 2';

    try {
      execSync(
        `toktx ${encodeArgs} ${colorSpace} "${output}" "${input}"`,
        { stdio: 'pipe' }
      );
      totalConverted++;
      const codec = isNormal ? 'UASTC' : 'ETC1S';
      console.log(`    ✓ ${file} → ${outputFile} (${codec})`);
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
