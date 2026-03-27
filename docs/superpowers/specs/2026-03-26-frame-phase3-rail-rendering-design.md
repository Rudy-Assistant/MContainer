# Design Spec: Frame Phase 3 — Rail Mesh Rendering

**Date:** 2026-03-26
**Scope:** Add 3D horizontal rail meshes connecting adjacent poles in ContainerSkin
**Prerequisite:** Phase 2 complete (all store/UI/2D infrastructure built)

---

## Problem

Frame mode renders structural poles as 3D cylinders but rails exist only in the store and 2D grid overlay. Users can select and configure rails in FrameInspector and the 2D FrameGridOverlay, but nothing renders in the 3D viewport. This makes frame mode feel incomplete — half the structural skeleton is invisible.

## What Already Exists

| System | Status | Location |
|--------|--------|----------|
| Rail key format (`r{row}c{col}_{h\|v}`) | ✅ | `frameMaterials.ts:32-34` |
| Material resolution (`resolveFrameProperty` for rails) | ✅ | `frameMaterials.ts:37-50` |
| Three.js material lookup (`getFrameThreeMaterial`) | ✅ | `materialCache.ts:242-248` |
| Store overrides (`container.railOverrides`) | ✅ | `containerSlice.ts` |
| FrameInspector UI (rail material/shape dropdowns) | ✅ | `FrameInspector.tsx:23-123` |
| 2D grid visualization (clickable rail lines) | ✅ | `MatrixEditor.tsx:895-961` |
| Pole rendering (template for rail rendering) | ✅ | `ContainerSkin.tsx:3442-3492` |

**Only 3D mesh rendering is missing.**

## Design

### 1. Smart Rail Position Computation

A pure function `computeRailPositions` takes the existing `pillarPositions` array and computes which rails to render. A rail renders only if **both** endpoint poles exist — no rails in empty space.

**Algorithm:**
1. Build a lookup map from `pillarPositions`: key = `"vr_vc"` (vertex row/col), value = `{ px, pz }`
2. For each potential horizontal rail `(vr, c)` where `vr ∈ [0..VOXEL_ROWS]`, `c ∈ [0..VOXEL_COLS-1]`:
   - Check if poles at `(vr, c)` AND `(vr, c+1)` both exist in the map
   - If both exist: emit rail with key `makeRailKey(vr, c, 'h')`, endpoints from map
3. For each potential vertical rail `(r, vc)` where `r ∈ [0..VOXEL_ROWS-1]`, `vc ∈ [0..VOXEL_COLS]`:
   - Check if poles at `(r, vc)` AND `(r+1, vc)` both exist in the map
   - If both exist: emit rail with key `makeRailKey(r, vc, 'v')`, endpoints from map

**Pole lookup key:** `pillarPositions` stores `{ row, col, corner, px, pz }`. Convert to vertex coordinates using corner → vertex mapping:
- `ne` corner of voxel `(row, col)` → vertex `(row, col+1)`
- `nw` corner of voxel `(row, col)` → vertex `(row, col)`
- `se` corner of voxel `(row, col)` → vertex `(row+1, col+1)`
- `sw` corner of voxel `(row, col)` → vertex `(row+1, col)`

Multiple poles may map to the same vertex (different voxels sharing a corner). Deduplicate by vertex key — use the first pole's position (they're at the same spot).

**Return type:**
```ts
interface RailPosition {
  key: string;        // e.g. "r0c3_h"
  px1: number;        // start pole X
  pz1: number;        // start pole Z
  px2: number;        // end pole X
  pz2: number;        // end pole Z
  orientation: 'h' | 'v';
}
```

**Memoization:** `useMemo` with `pillarPositions` as dependency (same stability as poles).

### 2. Rail Mesh Rendering

Insert a rail rendering block in ContainerSkin.tsx immediately after the pole block (`pillarPositions.map(...)`, ~line 3492), before the pool water plane.

Each rail renders as:
- **Geometry:** `getCyl(RAIL_R, length)` where `length = Math.hypot(px2 - px1, pz2 - pz1)` and `RAIL_R = 0.02`
- **Position:** Midpoint between endpoints, at roof height: `[(px1+px2)/2, vOffset + vHeight/2, (pz1+pz2)/2]`
- **Rotation:** Horizontal rails (h) rotate around Y to align with the X-axis direction between endpoints. Vertical rails (v) rotate to align with the Z-axis direction. Use `Math.atan2(dz, dx)` for the Y rotation.
- **Material:** `resolveFrameProperty(railOverride, container.frameDefaults, 'rail', 'material')` → `getFrameThreeMaterial(name, currentTheme)`

### 3. Rail Interaction (Frame Mode Only)

Same pattern as poles:
- `raycast={frameMode ? undefined : nullRaycast}` — only clickable in frame mode
- `onPointerOver` — apply `frameHoverMat`, track in `hoveredRailRef`
- `onPointerOut` — restore resolved material
- `onClick` — call `setSelectedFrameElement({ containerId, key, type: 'rail' })`

**`hoveredRailRef`:** New ref `useRef<{ mesh: THREE.Mesh; material: THREE.Material } | null>(null)` — same pattern as `hoveredPoleRef`. Separate ref because a user could hover from a pole directly to a rail.

### 4. Rail Visibility Override

Before rendering each rail mesh:
```ts
const railOverride = container.railOverrides?.[key];
if (railOverride?.visible === false) return null;
```

Same pattern as poles checking `poleOverride?.visible === false`.

### 5. No Animation

Rails appear/disappear instantly with their endpoint poles. No `PillarFoldDown` equivalent. YAGNI — animation can be added in a future sprint if desired.

## Files

- **Modify:** `src/components/objects/ContainerSkin.tsx`
  - Add `RAIL_R` constant (~0.02)
  - Add `computeRailPositions` pure function (exportable for testing)
  - Add `railPositions` useMemo
  - Add `hoveredRailRef`
  - Add rail rendering block after poles
- **Create:** `src/__tests__/rail-positions.test.ts` — unit tests for `computeRailPositions`

## Tests

### Unit tests (`rail-positions.test.ts`)
- `computeRailPositions` with 4-corner poles (simple box) → returns 4 horizontal + 4 vertical rails
- `computeRailPositions` with L-shaped poles (missing one corner) → no rail across the gap
- `computeRailPositions` with empty input → returns empty array
- `computeRailPositions` with single pole → returns empty array (no adjacent pair)

### Browser verification
- Frame mode ON → rails visible as thin horizontal cylinders connecting poles
- Hover rail → cyan highlight
- Click rail → selected in FrameInspector, shows rail material/shape controls
- Change rail material in inspector → rail appearance updates
- Set rail `visible: false` in store → rail disappears
- Toggle frame mode OFF → rails disappear (only render in frame mode... wait, actually poles render in BOTH modes, just without interaction. Let me check.)

**Note:** Poles render in both modes with `raycast={frameMode ? undefined : nullRaycast}`. Rails should follow the same pattern — always visible, only interactive in frame mode. This matches the design spec for view isolation where frame mode hides walls/ceiling but poles/rails remain visible.

## Critical Invariants

1. **Never mutate refs inside Zustand selectors** — `hoveredRailRef` is only mutated in event handlers
2. **Floor-based hitbox paradigm** — rails use `raycast={nullRaycast}` outside frame mode
3. **`computeRailPositions` must be a pure function** — no store access, no side effects, testable in isolation
