# Current Quality Assessment — V1.1

**Date:** 2026-03-14
**Method:** Code audit + Playwright regression (23/23 gates) + programmatic store/material inspection
**Baseline:** `npx tsc --noEmit` 0 errors, `npx vitest run` 243 passing, 0 type errors

---

## Feature Ratings

| Feature | Rating | Evidence | Gap to PRODUCTION |
|---------|--------|----------|-------------------|
| Container Rendering | **PRODUCTION** | PBR materials via materialCache.ts (refactored from ContainerSkin). Industrial: metalness=0.72, roughness=0.38, envMapIntensity=0.6 (→2.5 post-texture), corrugation normal maps. Environment intensity 0.65 for visible steel reflections. 3 themes with distinct material configs. | — |
| Furniture | **PRODUCTION** | 30 Kenney .glb models, useGLTF + GLBErrorBoundary, auto-scaled, theme-tinted. | — |
| Multi-Container Layouts | **PRODUCTION** | Smart placement, adjacency auto-merge, snap guides, drag move with Shift+G grab mode (arrow keys, Enter/Esc). | — |
| Model Homes | **PRODUCTION** | 6 presets, Playwright verified: showcase auto-loads 2+ containers on first visit. | — |
| Walkthrough | **PRODUCTION** | 1.6m eye height, WASD + mouse look, wall collision, auto-tour, envMapIntensity suppressed to 0.05. Hotbar keys 1-0 active in FP mode for in-situ painting. | — |
| Export | **PRODUCTION** | GLB + JSON export functional, GLTFExporter from three/addons. | — |
| Blueprint | **PRODUCTION** | Orthographic camera, 1m grid, dimension labels, SurfaceType edge colors. Playwright verified: viewMode switches correctly. | — |
| Theme System | **PRODUCTION** | 3 PBR themes (Industrial/Japanese/Desert), per-theme texture loading, instant switch. Playwright verified theme cycling. | — |
| Stacking | **PRODUCTION** | Multi-level at Y=2.9m, staircase auto-void, level visibility tiers, PgUp/PgDn. | — |
| Save/Load | **PRODUCTION** | IndexedDB + Zod validation, blocks/containers/homes library, 6 model home presets, export/import. | — |
| Door System | **PRODUCTION** | 3-state cycle (closed→swing→slide), animated via useFrame lerp, right-click menu. | — |
| Extension System | **PRODUCTION** | Deck extensions, wood plank textures, bulk activate/deactivate, railing types. | — |
| Undo/Redo | **PRODUCTION** | 50-snapshot zundo temporal, Ctrl+Z/Y, drag debounce. Playwright verified: undo fires without crash. | — |
| Adjacency | **PRODUCTION** | Auto-merge Solid_Steel→Open, separation restores originals, STICKY_THRESHOLD=0.3. | — |
| Custom Palette System | **PRODUCTION** | 3 built-in palettes derived from themes.ts, user palettes with save/update/delete, applyPalette mutates material cache in-place, palette modal with color/metalness/roughness controls. Playwright verified: savePalette creates entry, deletePalette removes it. | — |
| Staircase System | **PRODUCTION** | 2-voxel span (lower/upper/single), 6/3 treads via StairMesh, auto-direction from neighbors, auto-ceiling void (same container + cross-container), side railings on Open faces. stampStaircase now delegates full stair metadata (voxelType, stairDir, stairAscending, stairPart). Playwright verified: voxelType='stairs', stairDir='ns'. | — |
| Hotbar + Controls | **PRODUCTION** | 10-slot hotbar (keys 1-0), row scrolling (Tab/=/-), Alt+click eyedropper, spacebar repeat, view shortcuts (Alt+3/Alt+4/F/V), Shift+G grab mode, context-aware tab auto-switch, R rotate, Delete guard (voxel→container). Playwright verified: all key bindings fire correctly. | — |
| Ground + Atmosphere | **PRODUCTION** | Grass: solid color #4a6630 + displacement (no tiling artifacts). Fog: time-adaptive (night/golden/day), near=60 far=180 hides ground edge. Sky: drei Sky + Stars, time-of-day orbit. Environment: 0.65 intensity for PBR reflections. | — |

---

## Summary

| Rating | Count | Features |
|--------|-------|----------|
| PRODUCTION | 18 | All features |
| FUNCTIONAL | 0 | — |
| BROKEN | 0 | — |

**V1.1 — 18 features at PRODUCTION quality. +4 new features since V1.0.**

---

## Sprint History (V1.0 → V1.1)

| Feature | Previous | Now | What Changed |
|---------|----------|-----|-------------|
| Custom Palette System | NEW | **PRODUCTION** | Built-in palettes from themes, user palette CRUD, material mutation via applyPalette |
| Staircase System | Partial | **PRODUCTION** | stampStaircase fixed to set voxelType/stairDir/stairAscending/stairPart; buildStairFaces shared helper |
| Hotbar + Controls | 8 slots | **PRODUCTION** | Expanded to 10 slots, +row scrolling, +eyedropper, +spacebar repeat, +view shortcuts, +grab mode |
| Ground + Atmosphere | Tiling artifacts | **PRODUCTION** | Solid color grass (no tile seams), fog tightened (60-180m), materialCache refactored to own file |
| Container Rendering | PRODUCTION | **Updated** | envMapIntensity 0.4→0.65, steel confirmed at 0x607080/metalness=0.72/roughness=0.38 |

---

## Architecture Changes (V1.1)

| Change | Files |
|--------|-------|
| Material cache extracted | `src/config/materialCache.ts` (new) — owns ThemeMaterialSet, buildThemeMaterials, _themeMats singleton |
| Keyboard controls documented | `CLAUDE.md` — full controls reference table |
| Store additions | `uiSlice.ts` — activeHotbarTab, lastStamp, grabMode (all ephemeral) |

---

## Evidence Sources

- Playwright regression: 23/23 gates PASS (2026-03-14)
- Test suite: 243 vitest tests passing, 0 type errors
- Material values confirmed via grep: themes.ts steel=0x607080, materialCache envMapIntensity=0.6→2.5
- Ground: #4a6630 solid + displacement, envMapIntensity=0.12
- Fog: day=#a8c0d0, golden=#d4c4a8, night=#060614 (near=60, far=180)

---

## Version History

| Version | Date | Highlights |
|---------|------|-----------|
| V1.1 | 2026-03-14 | 18 features PRODUCTION. 243 tests. Store refactored to 7 slices. materialCache.ts extracted. Full keyboard control system. Custom palette system. Ground/atmosphere polish. Staircase fix. Hotbar expanded to 10 slots. |
| V1.0 | 2026-03-13 | 14 features PRODUCTION. 227 tests. Furniture GLBs, walkthrough polish, door system, extension system. |
| Sprint 13 | 2026-03-12 | Original assessment — 7 PRODUCTION, 7 FUNCTIONAL. |
