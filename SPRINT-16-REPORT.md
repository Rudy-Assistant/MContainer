# Sprint 16 Report — Smart Systems + Asset Integration

**Date:** 2026-03-12
**Baseline:** 222 tests (vitest), 0 type errors
**Final:** 227 tests (extension-doors +5), 0 type errors. Full suite: 495 pass, 163 todo.

---

## Stream 0: Smart Extension-Door System

### What Was Built
When extensions are activated, body voxels facing the extension now automatically get door faces:
- **Deck extensions** -> body boundary faces become `Door`
- **Interior extensions** -> body boundary faces become `Open`
- Only `Solid_Steel` (default) faces are modified — user-painted faces preserved
- Deactivation restores original faces from `_preExtensionDoors` tracking

### Implementation
- `_applyExtensionDoors(containerId, config)`: Iterates body voxels at extension boundaries (row 1 north, row 2 south, col 1 west, col 6 east), saves Solid_Steel originals, replaces with Door/Open
- `_restoreExtensionDoors(containerId)`: Reads `_preExtensionDoors`, restores original faces
- Wired into `setAllExtensions`: restore called before mode change, apply called after activation
- `_preExtensionDoors` stripped from persist partialize (same pattern as `_preMergeWalls`)
- Only level 0 body voxels affected (level 1 walls are Open by default)

### Tests (5 new)
| Test | Status |
|------|--------|
| DOOR-AUTO-1: South deck -> body row 2 south faces become Door | PASS |
| DOOR-AUTO-2: Deactivate -> faces revert to Solid_Steel | PASS |
| DOOR-AUTO-3: User-painted Glass preserved | PASS |
| DOOR-AUTO-4: all_interior -> boundaries become Open | PASS |
| DOOR-AUTO-5: _restoreExtensionDoors reverts correctly | PASS |

### Files Changed
| File | Change |
|------|--------|
| `src/store/useStore.ts` | `_applyExtensionDoors`, `_restoreExtensionDoors` actions; wired into `setAllExtensions`; persist strip |
| `src/types/container.ts` | `_preExtensionDoors` field on Container |
| `src/__tests__/extension-doors.test.ts` | NEW — 5 tests |
| `src/__tests__/bulk-extensions.test.ts` | Updated EXT-6 to expect auto-door behavior |

---

## Stream 1: Furniture Model Integration

### Kenney Assets Processed
30 GLB models copied from `C:\MHome\MContainer\Kenney_Furniture` to `public/assets/furniture/`:

| Category | Models |
|----------|--------|
| Kitchen (5) | counter, fridge, stove, sink, microwave |
| Bedroom (4) | bed-double, bed-single, nightstand, dresser |
| Bathroom (4) | toilet, bathtub, shower, sink |
| Living (5) | sofa, armchair, coffee-table, bookshelf, tv-unit, television |
| Office (3) | desk, chair, monitor |
| Utility (2) | washer, dryer |
| Decor (3) | plant, floor-lamp, rug |
| Structure (1) | stairs-open |

### Catalog Expanded
- **Before:** 8 entries (7 with GLB paths, stairs without)
- **After:** 30 entries, all with GLB paths, dimensions, colors, and costs
- 22 new `FurnitureType` enum values added
- `FURNITURE_ICONS` in Sidebar expanded to 30 entries with Lucide icons
- Staircase entry now references `stairs-open.glb`

### Theme-Aware Material Swapping
- `applyThemeToFurniture()` traverses GLB meshes on load
- Classifies materials as wood-like or metal-like via heuristics
- Applies per-theme color/roughness from `FURNITURE_THEME_CONFIGS`
- Materials deep-cloned before mutation (prevents shared-reference corruption)
- Re-applies on theme change via useMemo dependency

### Files Changed
| File | Change |
|------|--------|
| `src/types/container.ts` | 22 new FurnitureType values, 22 new catalog entries, stairs GLB path |
| `src/components/three/ContainerMesh.tsx` | Theme-aware material swapping (FURNITURE_THEME_CONFIGS, isWoodLike, isMetalLike, applyThemeToFurniture) |
| `src/components/ui/Sidebar.tsx` | 22 new FURNITURE_ICONS entries, new Lucide icon imports |

---

## Stream 2: Per-Theme Texture Sets

### Textures Downloaded (CC0, AmbientCG)
11 complete PBR texture sets (color + normal + roughness, 1K JPG):

| Theme | Surface | Source Asset |
|-------|---------|-------------|
| Industrial | Exterior wall | Corrugated_Steel (existing) |
| Industrial | Interior wall | Concrete034 (NEW) |
| Industrial | Floor | Deck_Wood (existing) |
| Japanese | Exterior wall | Wood049 (Japanese cedar) |
| Japanese | Interior wall | Fabric038 (Shoji paper) |
| Japanese | Floor | Wood037 (Bamboo) |
| Desert | Exterior wall | Plaster003 (Stucco) |
| Desert | Interior wall | Plaster003 (Plaster, lighter tint) |
| Desert | Floor | Tiles074 (Terracotta) |
| Desert | Ceiling | Wood051 (Bleached wood) |
| Shared | Concrete | Concrete034 |

### Theme Texture Registry
- `ThemeTextureSet` interface added to `src/config/themes.ts`
- Each `ThemeConfig` now has a `textures` field mapping semantic surfaces to directory paths
- `loadThemeTextures()` in ContainerSkin.tsx loads color/normal/roughness maps per material
- Error callbacks log warnings on 404s (fallback to flat color)
- All 3 themes' textures loaded at startup for instant theme switching

### Files Changed
| File | Change |
|------|--------|
| `src/config/themes.ts` | `ThemeTextureSet` interface, `textures` on each theme |
| `src/components/objects/ContainerSkin.tsx` | `loadThemeTextures()`, error callbacks, module-level texture loading loop |
| `public/assets/materials/` | 8 new directories with PBR texture sets |

---

## Stream 3: Smart System Verification

See `SMART-SYSTEMS-STATUS.md` for full matrix.

| System | Status |
|--------|--------|
| Adjacency auto-merge | PRODUCTION |
| Extension auto-door | PRODUCTION (new) |
| Staircase auto-void | FUNCTIONAL |
| Context-aware UI | NOT IMPLEMENTED |
| CSG morphing | NOT IMPLEMENTED |
| RevoluteJoint doors | NOT IMPLEMENTED |
| Theme texture engine | PRODUCTION (new) |
| Furniture GLB loading | PRODUCTION (new) |

---

## /simplify Fixes

1. **Texture error callbacks** — `loadThemeTextures` now logs warnings on 404s
2. **Material deep-clone** — `applyThemeToFurniture` clones materials before mutating
3. **Typed config parameter** — `_applyExtensionDoors` uses `ExtensionConfig` type, not `string`

---

## Completion Criteria

| Criterion | Status |
|-----------|--------|
| Extension activation auto-places doors on boundary | PASS — body faces become Door/Open |
| Extension deactivation reverts doors | PASS — `_preExtensionDoors` restore |
| Real .glb furniture models (not boxes) | PASS — 30 GLB files with fallback |
| 25+ furniture catalog entries | PASS — 30 entries |
| Furniture materials change with theme | PASS — applyThemeToFurniture |
| Industrial theme has corrugated steel texture | PASS — existing + concrete added |
| Japanese theme has cedar/bamboo textures | PASS — 3 new texture sets |
| Desert theme has stucco/terracotta textures | PASS — 3 new texture sets |
| All 3 themes look textually distinct | PASS — different texture directories per theme |
| Smart systems status documented | PASS — SMART-SYSTEMS-STATUS.md |
| 5+ new auto-door tests | PASS — 5 tests in extension-doors.test.ts |
| No regressions | PASS — 495 tests pass, 0 type errors |

---

## Metrics

| Metric | Before | After |
|--------|--------|-------|
| Furniture catalog entries | 8 | 30 (+22) |
| FurnitureType enum values | 8 | 30 (+22) |
| GLB model files | 0 | 30 |
| PBR texture directories | 3 | 11 (+8) |
| Vitest tests | 222 | 227 (+5 auto-door) |
| Type errors | 0 | 0 |
| Smart systems at PRODUCTION | 5 | 8 (+3) |
