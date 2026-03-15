# Dead Code Audit — ModuHome V1

**Date:** 2026-03-14 (updated)
**Scope:** All `.ts` and `.tsx` files in `src/`
**Method:** Import graph analysis via ripgrep + manual verification

---

## Recent File Changes (V1.0 → V1.1)

| File | Status | Notes |
|------|--------|-------|
| `src/utils/generateTreeSprite.ts` | **DELETED** | Billboard trees removed — procedural canvas sprite no longer needed |
| `src/utils/stairGeometry.ts` | **DELETED** (V1.0) | Orphaned stair utility — stair rendering is inline in ContainerSkin |
| `src/config/materialCache.ts` | **NEW** | Owns `_themeMats`, `ThemeMaterialSet`, `buildThemeMaterials`, `getTextureLoader`. Extracted from ContainerSkin.tsx |
| `src/utils/applyPalette.ts` | **NEW** | Applies `MaterialPalette` to `_themeMats` instances. Imports from materialCache |
| `src/store/slices/*.ts` (7 files) | **NEW** | All store logic extracted from useStore.ts. useStore.ts reduced from 3,529 to 252 lines |

---

## Confirmed Dead Code (Existing but unused UI components)

These files exist in `src/components/ui/` but have no active imports. They are legacy code from pre-V1 development and can be safely deleted:

| File | Lines | Notes |
|------|-------|-------|
| `GameHUD.tsx` | 173 | Legacy game-style HUD — replaced by TopToolbar + SmartHotbar |
| `MaterialPalette.tsx` | 147 | Old palette UI — replaced by MaterialPaletteModal.tsx |
| `Palette.tsx` | 262 | Old palette component — replaced by MaterialPaletteModal.tsx |
| `PricingWidget.tsx` | 77 | Old pricing display — replaced by BudgetModal.tsx |
| `StyleSelector.tsx` | 88 | Old style picker — replaced by theme system in Sidebar |
| `ViewModeToggle.tsx` | 38 | Old view toggle — replaced by TopToolbar view pill |
| `ViewToggle.tsx` | 189 | Another old view toggle — replaced by TopToolbar view pill |

**Recommendation:** Delete all 7 files. They are not imported anywhere and have been fully superseded.

---

## Confirmed Dead Code (Utility files)

| File | Lines | Notes |
|------|-------|-------|
| `src/utils/PhysicsUtils.ts` | 171 | Rapier physics utilities — Rapier is not installed |
| `src/utils/ProxyGeometry.ts` | 164 | Proxy geometry builder — not imported |
| `src/utils/SelectionManager.ts` | 190 | Old selection system — replaced by selectionSlice |
| `src/systems/InputMap.ts` | 115 | Input mapping system — not imported |

**Recommendation:** Delete all 4 files.

---

## Active Files (All Have Imports)

### Config (`src/config/`)
| File | Key Importers |
|------|--------------|
| `materialCache.ts` | ContainerSkin, Scene, applyPalette |
| `themes.ts` | materialCache, Sidebar, tests |
| `groundPresets.ts` | GroundManager, MaterialPaletteModal |
| `pbrTextures.ts` | Scene (PBRTextureLoader) |
| `containerPresets.ts` | Sidebar, containerSlice, tests |
| `containerRoles.ts` | Sidebar, containerSlice, tests |
| `moduleCatalog.ts` | voxelSlice, SmartHotbar |
| `surfaceCycles.ts` | SmartHotbar, ContainerSkin |
| `modelHomes.ts` | librarySlice |
| `libraryPresets.ts` | UserLibrary |

### Store (`src/store/`)
| File | Role |
|------|------|
| `useStore.ts` (252 lines) | Middleware chain + type exports (50+ importers) |
| `slices/containerSlice.ts` (1826) | Container CRUD, zones, furniture, stacking |
| `slices/voxelSlice.ts` (896) | Face mutations, stairs, doors, modules |
| `slices/environmentSlice.ts` (89) | TOD, theme, viewMode, camera |
| `slices/uiSlice.ts` (80) | Hover, preview, grab mode, lastStamp |
| `slices/selectionSlice.ts` (195) | Selection, brush, hotbar, clipboard |
| `slices/dragSlice.ts` (217) | Drag state, context menus |
| `slices/librarySlice.ts` (382) | Library, palettes, export/import |
| `idbStorage.ts` (8) | IndexedDB StateStorage adapter |
| `persistSchema.ts` (29) | Zod validation for hydration |
| `spatialEngine.ts` (630) | Stack target, edge snap, overlap, pool union |
| `containerStore.ts` (444) | Legacy store — still imported by ContainerMesh |
| `frameStore.ts` (279) | Frame builder state (separate from main store) |

### Components
All component files in `objects/`, `three/`, and active `ui/` files have imports from page.tsx, Scene.tsx, or sibling components.

### WalkthroughControls.tsx (1182 lines)
Uses drei `<PointerLockControls>` as foundation. Remaining ~1130 lines provide voxel-granular collision, floor detection, auto-tour, smart spawn, door toggling. **Not a candidate for replacement.**

---

## Circular Dependencies

None detected in import graph. Slice files use lazy accessor injection to avoid circular imports (e.g., `setLibraryTemporalAccessor`, `setVoxelStoreRef`).
