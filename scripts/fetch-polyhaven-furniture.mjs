#!/usr/bin/env node
/**
 * fetch-polyhaven-furniture.mjs — Download CC0 furniture GLBs from
 * Polyhaven (and other CC0 sources) into public/assets/furniture/.
 *
 * Reads the registry at src/config/polyhavenSources.ts. Idempotent — skips
 * files that already exist locally with a non-empty body. Run with:
 *
 *   node scripts/fetch-polyhaven-furniture.mjs           # download missing
 *   node scripts/fetch-polyhaven-furniture.mjs --force   # re-download all
 *
 * No npm dependencies — uses only Node's built-in fetch + fs.
 */

import { writeFile, stat, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TARGET_DIR = resolve(ROOT, 'public', 'assets', 'furniture');
const FORCE = process.argv.includes('--force');

// Inline the registry shape to avoid an ESM/TS interop wrapper.
// Source of truth: src/config/polyhavenSources.ts. When you add entries
// there, also add them here (they're read-only mirrors of each other).
const REGISTRY = [
  // EXAMPLE — keep in sync with POLYHAVEN_FURNITURE:
  // { filename: 'dining-chair.glb', url: 'https://dl.polyhaven.org/file/ph-assets/Models/glb/2k/wooden_chair/wooden_chair_2k.glb', credit: 'Wooden Chair — Polyhaven (CC0)' },
];

async function exists(path) {
  try { const s = await stat(path); return s.isFile() && s.size > 0; }
  catch { return false; }
}

async function downloadOne(entry) {
  const target = resolve(TARGET_DIR, entry.filename);
  if (!FORCE && await exists(target)) {
    console.log(`  [skip] ${entry.filename} (already present)`);
    return;
  }
  console.log(`  [get]  ${entry.filename} ← ${entry.url}`);
  const res = await fetch(entry.url);
  if (!res.ok) {
    console.warn(`  [fail] ${entry.filename}: HTTP ${res.status}`);
    return;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(target, buf);
  console.log(`         → ${(buf.length / 1024).toFixed(1)} KB · credit: ${entry.credit}`);
}

async function main() {
  if (REGISTRY.length === 0) {
    console.log('Registry is empty. Populate src/config/polyhavenSources.ts and mirror entries here.');
    return;
  }
  await mkdir(TARGET_DIR, { recursive: true });
  console.log(`Fetching ${REGISTRY.length} CC0 furniture asset(s) into ${TARGET_DIR}`);
  for (const entry of REGISTRY) {
    try { await downloadOne(entry); }
    catch (err) { console.warn(`  [err]  ${entry.filename}: ${err?.message ?? err}`); }
  }
  console.log('Done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
