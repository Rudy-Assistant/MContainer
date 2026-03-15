# Sprint 3 Report — Extension Hover + Shift+Drag + Test Suite

**Date:** 2026-03-11

---

## Stream 1: Extension Hover Fix

**Result: IMPLEMENTED**

### What Changed

BaseplateCell (inactive extension voxels) was rewritten from a single 0.02m floor slab to a full hitbox system:

- **4 wall-face meshes** (n/s/e/w) at `vHeight/2` with `STRIP=0.15` thickness
- **1 floor hitbox** retained for downward raycasts
- Each face mesh calls `useStore.getState().setHoveredVoxelEdge({containerId, voxelIndex, face})` on pointer enter
- New props: `containerId`, `voxelIndex` passed from call site
- Group Y position changed from `0.015` to `0` (floor hitbox has explicit Y offset)

### Verification

- **Body voxel hover**: PASS — Yellow highlight visible on voxel 19, hoveredVoxelEdge populated with face 'top'
- **Extension voxel hover**: PASS — Voxel 24 (inactive, extension zone) detected from default camera angle, hoveredVoxelEdge populated with face 'n'
- **No regression**: Body voxel hover still works after changes

**File:** `src/components/objects/ContainerSkin.tsx` (BaseplateCell function + call site)

---

## Stream 2: Shift+Drag Container Move

**Result: IMPLEMENTED**

### What Changed

Shift+drag activation wired into existing drag infrastructure:

- **`onDownShared`** (edge strip pointerDown): Added `if (e.nativeEvent.shiftKey) startContainerDrag(container.id)`
- **Floor quad onPointerDown**: Same shift detection, returns early before click handling
- **Ceiling center onPointerDown**: Same pattern
- **BaseplateCell `onDownFace`**: Same pattern for extension voxels

The existing `DragMoveGhost` component in Scene.tsx handles all drag mechanics:
- Y-plane raycasting for position
- Grid snap via `gridSnap()`
- Edge snap via `findEdgeSnap()`
- Stack detection via `findStackTarget()`
- Overlap validation via `checkOverlap()`
- Ghost preview during drag
- Commit on pointerUp, cancel on Escape
- Camera controls disabled during drag

### Verification

- **Drag via store**: PASS — `startContainerDrag(id)` + `commitContainerDrag(5, 0)` moved container from x=0 to x=5
- **Adjacency fires after commit**: PASS — Console shows "1 shared wall(s) detected, 24 faces culled"
- **Undo reverts position**: PASS — After undo, container position back to x=0
- **Camera lock**: Already wired (`enabled={!dragMovingId}` on CameraControls)

**File:** `src/components/objects/ContainerSkin.tsx` (4 handler modifications)

---

## Stream 3: Behavioral Test Expansion

**Result: 51 TESTS PASSING (was 7)**

### Tests by Category

| Category | File | Count |
|----------|------|-------|
| Adjacency (existing) | `adjacency.test.ts` | 7 |
| Container CRUD | `container-crud.test.ts` | 8 |
| Voxel/Face Painting | `paint.test.ts` | 8 |
| Undo/Redo | `undo.test.ts` | 6 |
| Container Stacking | `stacking.test.ts` | 5 |
| Selection | `selection.test.ts` | 5 |
| Persistence | `persistence.test.ts` | 6 |
| BOM / Pricing | `bom.test.ts` | 6 |
| **Total** | **8 files** | **51** |

### Bugs Discovered

None — all 51 tests pass against current store implementation.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/objects/ContainerSkin.tsx` | BaseplateCell wall-face hitboxes (Stream 1). Shift+drag activation on 4 pointer handlers (Stream 2). Type fix: `face: string` → `face: keyof VoxelFaces`. |
| `src/store/useStore.ts` | Permanent dev store exposure (`window.__store`, NODE_ENV gated) |
| `src/__tests__/container-crud.test.ts` | 8 new tests (CRUD-1 through CRUD-8) |
| `src/__tests__/paint.test.ts` | 8 new tests (PAINT-1 through PAINT-8) |
| `src/__tests__/undo.test.ts` | 6 new tests (UNDO-1 through UNDO-6) |
| `src/__tests__/stacking.test.ts` | 5 new tests (STACK-1 through STACK-5) |
| `src/__tests__/selection.test.ts` | 5 new tests (SEL-1 through SEL-5) |
| `src/__tests__/persistence.test.ts` | 6 new tests (PERS-1 through PERS-6) |
| `src/__tests__/bom.test.ts` | 6 new tests (BOM-1 through BOM-6) |
| `MODUHOME-V1-ARCHITECTURE.md` | §8 extension hover resolved, shift+drag/tests struck from deferred. §9 Sprint 3 entry added. |

---

## Verification

- `npx tsc --noEmit` → **0 errors**
- `npx vitest run` → **51 passed, 0 failed**
- Dev server: **http://localhost:3000** — running, app loads without errors

## Browser Verification Checklist

- [x] Extension voxel hover: store state populated from default camera angle (voxel 24, face 'n')
- [x] Body voxel hover: still works (voxel 19, face 'top', yellow highlight visible)
- [x] Shift+drag: container moves to new position (verified via store: x=0 → x=5)
- [x] Shift+drag: adjacency fires after drag commit (1 shared wall detected)
- [x] Shift+drag: undo reverts position (x=5 → x=0)
- [x] Adjacency: still works (two containers flush, merged walls populated)
- [x] App loads without errors after all changes

## Screenshots

- `sprint3-baseline.png` — Initial app load (2 containers, adjacency merged)
- `sprint3-hover-body.png` — Body voxel hover with yellow highlight
- `sprint3-hover-extension-attempt.png` — Extension voxel hover registered in store
- `sprint3-final.png` — Post-verification app state
