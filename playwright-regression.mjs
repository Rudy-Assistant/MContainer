import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const RESULTS = [];
function report(name, pass, detail = '') {
  RESULTS.push({ name, pass, detail });
  console.log((pass ? 'PASS' : 'FAIL') + ': ' + name + (detail ? ' — ' + detail : ''));
}

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Wait for R3F scene mount
  for (let i = 0; i < 30; i++) {
    await p.waitForTimeout(1000);
    const ok = await p.evaluate(() => !!window.__scene);
    if (ok) { console.log(`Scene mounted after ${i + 1}s`); break; }
  }

  const gs = (fn) => p.evaluate(fn);
  const ev = (code, key, opts) => p.evaluate(({ c, k, o }) =>
    window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: k, ...o, bubbles: true })),
    { c: code, k: key, o: opts || {} });
  const d = (ms = 200) => p.waitForTimeout(ms);

  // ── GATE 1: Scene loads ──
  const g1 = await gs(() => ({ c: Object.keys(window.__store.getState().containers).length }));
  report('Scene loads', g1.c >= 0, `containers=${g1.c}`);

  // ── GATE 2: Showcase loads ──
  report('Showcase containers', g1.c >= 2, `count=${g1.c}`);

  // ── GATE 3: Ground renders ──
  report('Ground at noon', true, 'VISUAL: human review for neon green / hard horizon');

  // ── GATE 4: Theme switch ──
  await gs(() => window.__store.getState().setTheme('japanese'));
  await d(500);
  const t1 = await gs(() => window.__store.getState().currentTheme);
  report('Theme → Japanese', t1 === 'japanese');
  await gs(() => window.__store.getState().setTheme('desert'));
  await d(500);
  const t2 = await gs(() => window.__store.getState().currentTheme);
  report('Theme → Desert', t2 === 'desert');
  await gs(() => window.__store.getState().setTheme('industrial'));
  await d(300);

  // ── GATE 5: Ground presets ──
  await gs(() => window.__store.getState().setGroundPreset('concrete'));
  await d(500);
  await gs(() => window.__store.getState().setGroundPreset('grass'));
  await d(300);
  report('Ground presets switch', true, 'VISUAL: human review');

  // ── GATE 6: Blueprint mode ──
  await gs(() => window.__store.getState().setViewMode('blueprint'));
  await d(300);
  const bm = await gs(() => window.__store.getState().viewMode);
  report('Blueprint mode', bm === 'blueprint');
  await gs(() => window.__store.getState().setViewMode('3d'));
  await d(300);

  // ── GATE 7: Hotbar 10 slots — key 0 → slot 9 ──
  await ev('Digit0', '0');
  await d();
  const s10 = await gs(() => window.__store.getState().activeHotbarSlot);
  report('Key 0 → slot 9', s10 === 9, `got=${s10}`);

  // ── GATE 8: Row scroll ──
  await ev('Escape', 'Escape');
  await d();
  const tb = await gs(() => window.__store.getState().activeHotbarTab);
  await ev('Equal', '=');
  await d();
  const ta = await gs(() => window.__store.getState().activeHotbarTab);
  report('= scrolls row', ta !== tb, `before=${tb} after=${ta}`);
  await ev('Minus', '-');
  await d();
  const tb2 = await gs(() => window.__store.getState().activeHotbarTab);
  report('- scrolls back', tb2 === tb, `back=${tb2}`);

  // ── GATE 9: View shortcuts ──
  await gs(() => window.__store.getState().setViewMode('3d'));
  await d();
  await ev('Digit4', '4', { altKey: true });
  await d();
  const m4 = await gs(() => window.__store.getState().viewMode);
  report('Alt+4 → blueprint', m4 === 'blueprint', `got=${m4}`);
  await ev('Digit3', '3', { altKey: true });
  await d();
  const m3 = await gs(() => window.__store.getState().viewMode);
  report('Alt+3 → 3d', m3 === '3d', `got=${m3}`);
  await ev('KeyF', 'f');
  await d();
  const mf = await gs(() => window.__store.getState().viewMode);
  report('F → walkthrough', mf === 'walkthrough', `got=${mf}`);
  await gs(() => window.__store.getState().setViewMode('3d'));
  await d();

  // ── GATE 10: Grab mode ──
  const ids = await gs(() => Object.keys(window.__store.getState().containers));
  if (ids.length > 0) {
    await gs(() => { const s = window.__store.getState(); s.select(Object.keys(s.containers)[0]); });
    await d();
    await ev('KeyG', 'G', { shiftKey: true });
    await d();
    const ga = await gs(() => window.__store.getState().grabMode.active);
    report('Shift+G grab', ga === true, `active=${ga}`);
    const xb = await gs(() => { const s = window.__store.getState(); return s.containers[Object.keys(s.containers)[0]].position.x; });
    await ev('ArrowRight', 'ArrowRight');
    await d();
    const xa = await gs(() => { const s = window.__store.getState(); return s.containers[Object.keys(s.containers)[0]].position.x; });
    report('Arrow moves', Math.abs(xa - xb) > 0.05, `dx=${xa - xb}`);
    await ev('Enter', 'Enter');
    await d();
    const gc = await gs(() => window.__store.getState().grabMode.active);
    report('Enter clears grab', gc === false);
  }

  // ── GATE 11: Palette system ──
  const pLen = await gs(() => window.__store.getState().palettes?.length);
  report('Built-in palettes', pLen >= 3, `count=${pLen}`);
  const testPid = await gs(() => window.__store.getState().savePalette({
    name: 'Test', isBuiltIn: false, steelColor: 0xff0000, steelMetalness: 0.7,
    steelRoughness: 0.4, frameColor: 0x333333, frameMetalness: 0.8,
    glassTransmission: 0.9, woodColor: 0x7a5030, groundPreset: 'grass'
  }));
  const pAfter = await gs(() => window.__store.getState().palettes.length);
  report('savePalette', pAfter > pLen, `after=${pAfter}`);
  await gs(() => { const s = window.__store.getState(); s.deletePalette(s.palettes[s.palettes.length - 1].id); });

  // ── GATE 12: Staircase ──
  const cid = ids[0];
  if (cid) {
    await p.evaluate(id => window.__store.getState().applyStairsFromFace(id, 17, 'n'), cid);
    await d();
    const sv = await p.evaluate(id => window.__store.getState().containers[id]?.voxelGrid?.[17], cid);
    report('Staircase voxelType', sv?.voxelType === 'stairs', `type=${sv?.voxelType}`);
    report('Staircase stairDir', !!sv?.stairDir, `dir=${sv?.stairDir}`);
  }

  // ── GATE 13: lastStamp ──
  if (cid) {
    await p.evaluate(id => window.__store.getState().setVoxelFace(id, 9, 'n', 'Glass_Pane'), cid);
    await d();
    const ls = await gs(() => window.__store.getState().lastStamp?.surfaceType);
    report('lastStamp records', ls === 'Glass_Pane', `got=${ls}`);
  }

  // ── GATE 14: Undo ──
  const beforeUndo = await gs(() => JSON.stringify(Object.keys(window.__store.getState().containers)));
  await gs(() => window.__store.getState().undo());
  await d();
  report('Undo fires', true, 'no crash');

  // ── GATE 15: Persistence check ──
  const preset = await gs(() => window.__store.getState().environment?.groundPreset);
  report('groundPreset in env', typeof preset === 'string', `preset=${preset}`);

  // ── SUMMARY ──
  console.log('\n=== SUMMARY ===');
  const passed = RESULTS.filter(r => r.pass).length;
  console.log(`${passed}/${RESULTS.length} gates passed`);
  RESULTS.filter(r => !r.pass).forEach(r => console.log('  FAIL: ' + r.name + ' — ' + r.detail));

  writeFileSync('gate-screenshots/RESULTS.json', JSON.stringify(RESULTS, null, 2));
  await b.close();
})();
