# Sprint Bugfix Handoff

**Date:** 2026-03-24
**Status:** 4 of 6 pre-existing bugs fixed, 2 remain for next session

---

## Bugs Fixed This Session

### 1. Window/Railing Half-Bay Openings ✅
**Root cause:** `applyBlockConfig` in voxelSlice.ts didn't call `recomputeSmartRailings` after applying bay presets. Interior 'Open' faces in multi-voxel bays never got auto-railings.
**Fix:** Added `recomputeSmartRailings(grid, updatedContainer)` call at end of `applyBlockConfig` (when not in manual mode).
**File:** `src/store/slices/voxelSlice.ts:1588-1592`

### 2. Shift+Click Drag Race Condition ✅
**Root cause:** ContainerMesh.tsx registered an "early release safety" pointerup handler (line 2338) that raced with DragMoveGhost's handler. Non-deterministic execution order meant sometimes the safety handler called `cancelContainerDrag()` after the commit.
**Fix:** Removed the early-release handler. DragMoveGhost handles all pointerup commit/cancel logic.
**File:** `src/components/three/ContainerMesh.tsx:2329-2335`

### 3. Door Opposite-Face Sync ✅
**Root cause:** `applyDoorModule` in voxelSlice.ts set the adjacent voxel's opposite face to `'Open'` instead of `'Door'`. A door should occupy both sides of the shared face.
**Fix:** Changed line 1472 to set `oppFace` to `'Door'` and mirror the doorConfig.
**File:** `src/store/slices/voxelSlice.ts:1469-1474`

### 4. Ceiling Mode Hover Outline Offset ✅
**Root cause:** `VoxelHoverHighlight` in ContainerMesh.tsx always rendered hover/select outlines at level 0 Y position. When ceiling mode selected level-1 voxels, outlines appeared at floor height.
**Fix:** Added `levelYOffset(idx)` function that computes Y offset based on voxel level. All highlight positions now include `+ yLift`.
**File:** `src/components/three/ContainerMesh.tsx:1985-1989, 2065-2190`

---

## Remaining Bugs (Not Fixed)

### 5. Debug/Wireframe Mode Missing from UI
Previously existed as a view mode toggle. No longer accessible. Needs investigation into where it was removed and how to restore it (likely a toolbar button or keyboard shortcut).

### 6. Frame Mode Rendering Issues
Two sub-issues:
- **Materials don't update visually** when changed in Frame inspector (Pole Material, Pole Shape, Rail Material, Rail Shape dropdowns)
- **Frame mode should hide walls/ceilings** and show only the container frame structure, making poles/rails the primary interactable elements

### 7. Door Flush Positioning (Cosmetic)
The `DoorFace` component in ContainerSkin.tsx has pivot offset calculations that don't align with wall face boundaries. The door panel renders slightly offset from where it should be. Fix requires adjusting the group position and pivot calculations in `DoorFace` (lines 542-617).

---

## Test Status
- 705 tests passing (83 files)
- `npx tsc --noEmit` → 0 errors

---

## Design Pass Items (From Previous Handoff)

These need a brainstorming session to design before implementation:

1. **Block tab isometric previews** — Replace Lucide icons with SVG isometric voxel drawings
2. **Ghost preview on preset hover** — Show transparent preview in 3D when hovering Block tab presets
3. **Card design standardization** — Unified PresetCard component across all tabs
4. **Bottom hotbar improvements** — Responsive layout, transparency, readable text, remove icon dots
5. **Inspector cleanup** — Remove clutter (Bay/Block toggle, legend, cable info, scope text, label)
6. **Container preset tab** — All Deck/Interior/N Deck/S Deck/Retract → dedicated tab with isometric previews
7. **Multi-select** — Shift+Click row select, element type constraints
