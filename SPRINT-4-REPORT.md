# Sprint 4 Report — Smart Systems Audit, UI Polish, Materials, Module Groundwork, GLB Export

**Date:** 2026-03-12

---

## Stream 1: Smart Systems Visual Audit

| Smart System | Status | Evidence | Notes |
|---|---|---|---|
| Adjacency auto-merge | WORKS | Store: mergedWalls populated/cleared on move. Console: "1 shared wall(s) detected" | Separation clears mergedWalls after rAF |
| Staircase auto-void | PARTIAL | Store: stairPart=lower/upper set, intra-container open passages work | Cross-container auto-void (L1→L0) not implemented |
| Smart placement | NOT IMPL | addContainer({x:0,y:0,z:0}) overlaps existing | V1 has no auto-offset logic |
| Level visibility tiers | WORKS | sprint4-level0.png, sprint4-level1.png | Clear visual distinction between active/ghosted/desaturated |
| Context-aware UI | WORKS | Hotbar appears on hover, inspector on selection | Face-specific cycles verified |
| Smart railing | WORKS | Store: Railing_Cable on exposed edges, Open on walkable neighbors | Body voxel 9 with Deck_Wood floor |
| Surface cycles | WORKS | WALL_CYCLE(9), FLOOR_CYCLE(5), CEIL_CYCLE(5) | src/config/surfaceCycles.ts |
| Bay module system | WORKS | cycleBayModule: panel_solid → panel_glass | Parallel to voxel system |

---

## Stream 2: UI Polish

- **Toolbar**: Increased border contrast (#f3f4f6 → #e5e7eb), stronger shadow, added backdrop blur
- **LiveBOM**: Total column now has subtle blue background highlight for prominence
- **Canvas hint overlay**: Already present from previous sprint (L-drag, R-drag, Scroll, Shift+drag)
- **Hotbar**: Number labels (1-8) already visible on slots
- **Inspector**: Section dividers already present from Phase 3

**Files:** `TopToolbar.tsx`, `LiveBOM.tsx`

---

## Stream 3: Material & Texture System

**Audit results:**
- 16 SurfaceType values with distinct PBR materials
- 3 complete theme presets (Industrial, Japanese Modern, Desert Modern)
- No external texture files — all procedural PBR
- Industrial steel: procedural corrugation normal map (DataTexture)
- Glass: MeshPhysicalMaterial with transmission (0.6-1.0)
- Japanese palette: hardcoded separate materials (Hinoki, Tatami, Washi, Shoji)

**Theme verification:**
- Industrial → grey metallic corrugated steel (sprint4-ui-after.png)
- Japanese → dark charred yakisugi (sprint4-theme-japanese.png)
- Desert → sand stucco warm tones (sprint4-theme-desert.png)

All surfaces render distinctly. No improvements needed — system is comprehensive.

---

## Stream 4: Furniture/Module System Groundwork

**Furniture system status:**
- Store actions: `addFurniture`, `removeFurniture`, `moveFurniture` — all functional
- 8 catalog items with dimensions and costs
- Items stored in `Container.furniture[]` + `furnitureIndex` for fast lookup
- **No 3D rendering** — store-only, deferred to future sprint

**Module architecture proposal** written in MODUHOME-V1-ARCHITECTURE.md §10:
- Modules = voxel presets + optional furniture mesh
- Directional side concept (inward/outward faces)
- Minimal viable: extend applyHotbarToVoxel to accept module presets

---

## Stream 5: GLB Export

**Implementation:**
- `src/utils/exportGLB.ts`: GLTFExporter utility with `exportSceneToGLB()` function
- `SceneExporter` component in Scene.tsx registers scene reference via `setExportScene()`
- "Export GLB" button added to ExportImport.tsx (emerald green, distinct from JSON export)
- `window.__exportGLB` exposed for Playwright testing

**Verification:** GLB file downloaded successfully (moduhome-export-*.glb). Warnings about ShaderMaterial (Sky) and unsupported lights are expected — geometry exports correctly.

---

## Stream 6: Test Expansion

**19 new tests in `smart-systems.test.ts`:**

| Category | Count | Tests |
|----------|-------|-------|
| Smart Placement | 3 | SP-1 overlap, SP-2 offset, SP-3 valid ID |
| Staircase | 3 | STAIR-1 lower, STAIR-2 upper, STAIR-3 undo |
| Smart Railing | 2 | RAIL-1 cable on exposed, RAIL-2 open on walkable |
| Surface Cycles | 2 | CYCLE-1 wall cycle, CYCLE-2 floor cycle |
| Shift+Drag | 4 | DRAG-1 start, DRAG-2 commit, DRAG-3 cancel, DRAG-4 position |
| Furniture | 3 | FURN-1 add, FURN-2 invalid container, FURN-3 default position |
| Export/Import | 2 | EXP-1 valid JSON, EXP-2 restore containers |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ui/TopToolbar.tsx` | Toolbar border/shadow/blur improvements |
| `src/components/ui/LiveBOM.tsx` | Total column blue background highlight |
| `src/utils/exportGLB.ts` | NEW — GLB export utility via GLTFExporter |
| `src/components/three/Scene.tsx` | SceneExporter component + setExportScene import |
| `src/components/ui/ExportImport.tsx` | "Export GLB" button added |
| `src/__tests__/smart-systems.test.ts` | NEW — 19 behavioral tests |
| `MODUHOME-V1-ARCHITECTURE.md` | §8 updated, §9 Sprint 4 entry, §10 Smart Systems & Modules |

---

## Verification

- `npx tsc --noEmit` → **0 errors**
- `npx vitest run` → **70 passed, 0 failed** (9 test files)
- Dev server: **http://localhost:3000** — running, app loads without errors
- GLB export: downloads successfully

## Completion Criteria

- [x] Smart Systems table complete (8 systems: 6 WORKS, 1 PARTIAL, 1 NOT IMPL)
- [x] UI visually improved (toolbar blur, BOM highlight)
- [x] All surface types render distinctly (3 themes verified)
- [x] §10 Smart Systems & Modules written in architecture doc
- [x] GLB export works
- [x] 70 tests passing (target: 65+)
- [x] 0 type errors
- [x] Sprint report with Playwright screenshots referenced

## Screenshots

- `sprint4-stacked.png` — Two stacked containers (L0 + L1)
- `sprint4-level0.png` — Level 0 active, L1 ghosted
- `sprint4-level1.png` — Level 1 active, L0 desaturated
- `sprint4-ui-before.png` — UI baseline before polish
- `sprint4-ui-after.png` — UI after toolbar improvements
- `sprint4-theme-japanese.png` — Japanese Modern theme
- `sprint4-theme-desert.png` — Desert Modern theme
- `sprint4-furniture.png` — Furniture added (store-only, no 3D mesh)
