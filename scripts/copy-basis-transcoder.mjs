import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../node_modules/three/examples/jsm/libs/basis');
const DEST = resolve(__dirname, '../public/basis');

if (!existsSync(SRC)) {
  console.warn('[copy-basis] three/examples/jsm/libs/basis not found — skipping');
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });

for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  const src = resolve(SRC, file);
  if (existsSync(src)) {
    cpSync(src, resolve(DEST, file));
    console.log(`[copy-basis] Copied ${file}`);
  } else {
    console.warn(`[copy-basis] ${file} not found in three — skipping`);
  }
}
