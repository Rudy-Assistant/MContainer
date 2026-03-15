# Sprint 13 Report — Infrastructure Hardening + Test Safety Net

**Date:** 2026-03-12
**Baseline:** 164 tests, 0 type errors (post-Sprint 12)
**Final:** 222 tests, 0 type errors

---

## Stream 0: Permanent Diagnostic Infrastructure

- Created `src/components/three/DevSceneExpose.tsx` — standalone component with `__inspectScene()` and `__inspectStore()`
- Removed inline DevSceneExpose from Scene.tsx, replaced with import
- Production guard: `process.env.NODE_ENV === 'production'` skips exposure
- `window.__store` exposure confirmed permanent at `useStore.ts:3528`
- **Verified via Playwright:** Both `__inspectScene()` (18 keys, 1385 meshes) and `__inspectStore()` (8 keys, 3 containers) return data

---

## Stream 1: E2E Regression Suite

Created `e2e/run-workflow-tests.ts` — 19 automated checks covering all Sprint 12 workflows.

| Test | Status |
|------|--------|
| app-loads-with-containers | PASS |
| scene-has-meshes | PASS |
| scene-has-lights | PASS |
| shadow-map-enabled | PASS |
| meshes-cast-shadows | PASS |
| add-container | PASS |
| remove-container | PASS |
| undo-restores-container | PASS |
| paint-voxel-face | PASS |
| theme-switch | PASS |
| viewmode-blueprint | PASS |
| viewmode-walkthrough | PASS |
| viewmode-3d | PASS |
| export-state | PASS |
| save-home-design | PASS |
| door-state-toggle | PASS |
| apply-container-role | PASS |
| persistence-indexeddb | PASS |
| inspect-store-works | PASS |

Added `test:e2e` script to package.json. All 19 pass.

---

## Stream 2: Store Behavioral Test Expansion

### Test Gap Analysis (SPRINT-13-TEST-GAP.md)
- 145 total store actions identified
- 13 completely untested actions found
- 18 actions with only 1 test file

### New Tests: 58 behavioral tests in `src/__tests__/store-coverage.test.ts`

| Category | Tests | Actions Covered |
|----------|-------|----------------|
| Furniture CRUD | 6 | addFurniture, removeFurniture, moveFurniture |
| Container Rename/Resize | 4 | renameContainer, resizeContainer |
| Voxel Clipboard | 4 | copyVoxel, pasteVoxel, copyVoxelStyle |
| Voxel Locking | 5 | toggleVoxelLock, isVoxelLocked |
| Pool Conversion | 2 | convertToPool |
| Great Room Demo | 2 | createGreatRoomDemo |
| Block Library | 2 | saveBlockToLibrary |
| Import/Export | 4 | exportState, importState |
| Toggle Roof/Floor | 4 | toggleRoof, toggleFloor |
| Dollhouse Toggle | 2 | toggleDollhouse |
| View Level | 3 | setViewLevel |
| Stamp Area | 3 | stampArea |
| Door State Cycle | 3 | toggleDoorState |
| Theme/Time/View | 3 | setTheme, setTimeOfDay |
| Undo Integration | 5 | undo for rename, roof, furniture, lock, stamp |
| Selection Expanded | 2 | selectMultiple, clearSelection |
| Stacking Expanded | 2 | unstackContainer, stackContainer Y position |
| Rotation Expanded | 2 | updateContainerRotation, undo rotation |

**Total:** 164 existing + 58 new = 222 tests

---

## Stream 3: Feature Gap Verification

### Door State: WORKS (store level)
Full cycle: `closed → open_swing → open_slide → closed`
Visual rendering of door state changes NOT verified via screenshot.

### Model Home Placement: WORKS
- 6 model home presets visible in Saved tab
- `placeModelHome('family_2bed')` creates 3 containers with correct sizes, positions, and stacking
- Roles applied to 2 of 3 containers

### Extension Overlap Prevention: WORKS
- Isolated containers: all 16 deck extensions activate
- Adjacent containers: 0 extensions activate (overlap check blocks correctly)
- Warning logged when extension deployment fails

Full details in `SPRINT-13-FEATURE-CLOSEOUT.md`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/three/DevSceneExpose.tsx` | NEW — standalone DevSceneExpose with __inspectScene + __inspectStore |
| `src/components/three/Scene.tsx` | Import DevSceneExpose from new file, removed inline version |
| `e2e/run-workflow-tests.ts` | NEW — 19 E2E workflow regression tests |
| `src/__tests__/store-coverage.test.ts` | NEW — 58 behavioral store tests |
| `package.json` | Added test:e2e script, playwright dev dependency |
| `SPRINT-13-TEST-GAP.md` | NEW — store action test gap analysis |
| `SPRINT-13-FEATURE-CLOSEOUT.md` | NEW — feature gap verification results |
| `DIAGNOSTIC-RESULTS.md` | NEW — Q1-Q5 diagnostic answers |

---

## Completion Criteria

| Criterion | Status |
|-----------|--------|
| DevSceneExpose permanent | PASS — Component exists, __inspectScene() works without injection |
| __inspectStore() works | PASS — Returns container count, theme, viewMode |
| E2E regression suite exists | PASS — `npm run test:e2e` passes with 19 checks |
| Store test gap documented | PASS — SPRINT-13-TEST-GAP.md lists untested actions |
| 50+ new behavioral tests | PASS — 58 new tests (222 total) |
| No source-scanning tests added | PASS — All new tests call functions + assert state |
| Door states verified or gap documented | PASS — Full cycle verified, visual gap documented |
| Model homes verified or gap documented | PASS — 6 presets, placement works |
| Extension overlap verified or gap documented | PASS — Prevention works correctly |
| Feature closeout written | PASS — SPRINT-13-FEATURE-CLOSEOUT.md |
| 0 type errors | PASS — tsc clean |

---

## Test Count Breakdown

| Category | Count |
|----------|-------|
| Unit/behavioral (vitest) | 222 |
| E2E workflow (playwright) | 19 |
| **Total** | **241** |
