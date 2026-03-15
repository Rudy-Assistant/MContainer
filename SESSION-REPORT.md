# Session Report — Undo/Redo + Persistence + UX Fixes

## Phase 1: Baseline Read

| Question | Finding |
|----------|---------|
| Q1: Store creation | `create<StoreState>((set, get) => ({...}))` at line 684, plain zustand, no middleware |
| Q2: State shape | Data: containers, zones, furnitureIndex, environment. UI: ~22 ephemeral keys |
| Q3: Persistence | Manual localStorage, 5s autosave interval in page.tsx, key "moduhome-project-v6" |
| Q4: Keyboard | addEventListener in Scene.tsx, Ctrl+Z/Y already wired |
| Q5: Dependencies | zustand 5.0.11, NO immer/zundo/idb-keyval/zod |
| Q6: React | React 19.2.3, Next.js 16.1.6, App Router, useSyncExternalStore available |

**Critical finding:** Store's `set()` uses spread-return partial merge pattern — incompatible with immer middleware. Decision: skip immer, use zundo temporal directly.

## Phase 2: Undo/Redo (zundo middleware)

- Installed `zundo@2.3.0`
- Wrapped store: `create()(temporal((set, get) => ({...}), opts))`
- Removed manual `_undoStack`/`_redoStack` system (38 `_pushUndo` call sites)
- Removed `canUndo`/`canRedo` state flags (unused in UI)
- `partialize`: tracks only `containers`, `zones`, `furnitureIndex`
- `equality`: shallow key-by-key comparison (prevents duplicate snapshots from UI-only changes)
- Drag debounce: `pause()`/`resume()` around container drag start/commit
- Undo/redo actions: pause tracking, call temporal undo/redo, clear selection, resume

**Complications:** Initial equality function `(a, b) => a === b` always returned false (new objects), flooding stack with duplicates. Fixed with per-key reference comparison.

**Verification:** All items PASS.

## Phase 3: IndexedDB + Zod Persistence

- Installed `idb-keyval@6.2.2`, `zod@4.3.6`
- Created `src/store/idbStorage.ts` — StateStorage adapter for idb-keyval
- Created `src/store/persistSchema.ts` — minimal Zod schema for hydration validation
- Added `persist` middleware (outermost): `create()(persist(temporal(...), persistOpts))`
- `partialize` persists: containers, zones, environment, viewMode, pricing, furnitureIndex, libraryBlocks, libraryContainers, customHotbar
- `onRehydrateStorage`: validates with Zod, sets `_hasHydrated` flag
- Added hydration guard in page.tsx ("Loading project..." screen)
- Removed manual localStorage autosave interval and load-on-mount
- `seedSingleContainer` runs after hydration if project is empty

## UX Fixes (Sprint)

### Extension Voxel Hover (BaseplateCell)
- **Problem:** Inactive extension voxels had a thin 0.02m floor-level hitbox, nearly impossible to hover from typical camera angles
- **Fix:** Changed to full-height (`vHeight`) invisible box centered at `vHeight/2`, covering the entire extension voxel volume

### Voxel Preview Proportions (VoxelPreview3D)
- **Problem:** 200px maxWidth + 1.35:1 aspect + zoom=34 made the elongated voxel (2.03×1.22×2.90m) appear too compact
- **Fix:** Widened to 240px maxWidth, 1.6:1 aspect, zoom=26, camera at [-3, 3.5, -5] to better show the long/narrow shape

### Scroll ↔ Hotbar Frame Indicator (SmartHotbar)
- **Problem:** Scroll-to-cycle changed surfaces but gave no visual feedback on the hotbar about which preset matched the preview
- **Fix:** Added `scrollPreviewSlot` computed value that matches `facePreview.surface` against preset faces. Renders a cyan frame + bottom dot indicator on the matching slot, animated with 150ms transition.

## Files Changed

| File | Change |
|------|--------|
| `src/store/useStore.ts` | Added temporal + persist middleware, removed manual undo/redo system, added `_hasHydrated` |
| `src/store/idbStorage.ts` | NEW — idb-keyval StateStorage adapter |
| `src/store/persistSchema.ts` | NEW — Zod schema for hydration validation |
| `src/app/page.tsx` | Replaced localStorage autosave with hydration guard + seed-on-hydrate |
| `src/components/ui/SmartHotbar.tsx` | Added scroll-preview frame indicator on hotbar |
| `src/components/ui/VoxelPreview3D.tsx` | Adjusted camera zoom/aspect for better proportions |
| `src/components/objects/ContainerSkin.tsx` | Full-height extension hitbox for reliable hover |
| `PHASE-1-FINDINGS.md` | NEW — Phase 1 findings |
| `SESSION-REPORT.md` | NEW — This report |

## Dependencies Added

| Package | Version |
|---------|---------|
| zundo | 2.3.0 |
| idb-keyval | 6.2.2 |
| zod | 4.3.6 |

## What To Do Next

1. **Extension wall interaction** — Extensions now hover reliably but lack per-face edge strips for wall painting. Body voxels have full edge/face hitboxes; extensions should get the same when active.
2. **Hotbar preset customization** — The 8 fixed presets cover common cases but users should be able to save custom face combos to empty slots 9-10.
3. **Multi-container adjacency auto-merge** — V1 already has adjacency detection but auto-merge of shared walls is partial.
4. **GLB export** — V1 has an Export button but the actual geometry export may need verification.
5. **Performance** — With persist middleware now async (IndexedDB), consider adding throttle to prevent excessive writes during rapid editing.
