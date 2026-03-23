# Stacking & Drag UX Fixes — Design Spec

**Date:** 2026-03-23
**Status:** Design
**Scope:** 4 bug fixes: stack visual feedback, partial wall merge, snap on palette drop, Shift+click drag

---

## Problem Statement

Four pre-existing UX bugs from the sprint-17 handoff:

1. **No stack visual feedback** — Drag-to-stack gesture exists (DragMoveGhost detects `stackTargetId` via `findStackTarget`) but users can't discover it because there's no visual indication when hovering over a valid stack target.
2. **Merge removes entire wall** — `refreshAdjacency` in containerSlice.ts has incorrect pitch calculations for mixed-size containers, causing geometric overlap checks to produce wrong results for 20ft-next-to-40ft scenarios.
3. **Snap bypassed on palette drop** — `addContainer` only calls `findEdgeSnap` when `position === undefined` (programmatic). Drag-drop from Library sidebar passes explicit coordinates, skipping snap entirely.
4. **Shift+click doesn't drag** — Shift+click on an unselected container only selects it. The drag gesture requires `isSelected && shiftKey`, making it a two-step process. Meanwhile CameraControls is disabled (correctly), so nothing happens.

---

## Fix 1: Stack Visual Feedback

### Scene.tsx — DragMoveGhost Section

When `stackTargetId` is populated during a container drag:

- Render a bright cyan wireframe box at the target container's top face, sized to match the target container dimensions
- Use `HIGHLIGHT_COLOR_SELECT` (`#00bcd4`) for consistency with existing selection highlights
- Add a floating "Stack Here" label (drei `<Html>`) above the wireframe
- Both wireframe and label only render when `stackTargetId` is set (already computed per-frame inside DragMoveGhost)

No store changes needed — `stackTargetId` is already part of the existing ghost position computation in DragMoveGhost.

---

## Fix 2: Partial Wall Merge (Pitch Math)

### containerSlice.ts — refreshAdjacency (~lines 1500-1576)

The geometric overlap check computes voxel world positions using pitch values derived from container dimensions. The bug is in how pitch maps grid indices to world coordinates for mixed-size containers.

**Current (buggy):**
```ts
const aColPitch = aDims.length / 6;
const aRowPitch = aDims.width / 2;
// World pos: a.position.z + (iter - 1.5) * aRowPitch
// World pos: a.position.x + -(iter - 3.5) * aColPitch
```

The offsets `1.5` and `3.5` are body-center assumptions. `iter` ranges over `_ROW_RANGE` (0-3 for rows) or `_COL_RANGE` (0-7 for cols), but body voxels are rows 1-2 and cols 1-6. The halo voxels (row 0, row 3, col 0, col 7) have different world positions.

**Fix:** Compute each voxel's world center position correctly by:
1. Using the full grid dimensions (not just body)
2. Mapping grid index → local position using the standard voxel layout math (same as `getVoxelLayout` in ContainerSkin)
3. Comparing world positions with a tolerance of half a voxel pitch

The overlap check logic itself (merge only if `aOverlaps` is true AND face is `Solid_Steel`) is correct — only the coordinate computation needs fixing.

---

## Fix 3: Snap on Palette Drop

### containerSlice.ts — addContainer (~lines 1788-1808)

**Current (buggy):**
```ts
if (position === undefined) {
  // Only snaps for programmatic placement
  const snap = findEdgeSnap(containers, null, x, z, size, 0);
  if (snap.snapped) { x = snap.x; z = snap.z; }
}
```

**Fix:** Always run snap logic regardless of how position was provided:
```ts
// Run snap for ALL placements (palette drag-drop AND programmatic)
const snap = findEdgeSnap(s.containers, null, x, z, size, 0);
if (snap.snapped) { x = snap.x; z = snap.z; }
```

This ensures containers dropped from the Library sidebar snap to nearby containers just like programmatically-placed ones.

---

## Fix 4: Shift+Click Select+Drag in One Gesture

### ContainerMesh.tsx — onPointerDown (~line 2394)

**Current (buggy):**
```ts
if (isSelected && e.nativeEvent.shiftKey) {
  dragPendingRef.current = { id, clientX, clientY };
} else {
  select(container.id, e.nativeEvent.shiftKey);
}
```

Requires container to already be selected before Shift+drag works.

**Fix:**
```ts
if (e.nativeEvent.shiftKey) {
  // Shift+click: select if needed, then initiate drag
  if (!isSelected) select(container.id);
  dragPendingRef.current = { id: container.id, clientX, clientY };
} else {
  select(container.id, false);
}
```

This makes Shift+click a single gesture: select + start drag tracking. The actual drag activates after the existing mouse-movement threshold in `onPointerMove`.

---

## Files Changed

| File | Type | Fixes |
|------|------|-------|
| `src/components/three/Scene.tsx` | Modify | Fix 1: Stack wireframe + "Stack Here" label in DragMoveGhost |
| `src/store/slices/containerSlice.ts` | Modify | Fix 2: Merge pitch math; Fix 3: Snap on palette drop |
| `src/components/three/ContainerMesh.tsx` | Modify | Fix 4: Shift+click select+drag one gesture |
| `src/Testing/stacking-drag-fixes.test.ts` | Create | Unit tests for snap-always, Shift+drag logic |

**No new store atoms. No new dependencies. No new components.**

---

## Testing Strategy

1. **Snap-always test** — call `addContainer` with explicit position near an existing container, verify resulting position is snapped
2. **Shift+drag logic** — verify the pointerDown condition change: Shift+click on unselected container should set dragPendingRef
3. **Merge overlap** — unit test with two differently-sized containers side by side, verify only geometrically-overlapping voxels get merged
4. **Existing test suite** — all 685 tests must continue passing
5. **Playwright verification** — place two containers, verify snap; Shift+drag a container; stack visual feedback during drag

## Out of Scope

- Drag reordering of stacked containers
- Unstacking via drag gesture (only via Inspector ✕ button)
- Multi-container snap (snapping to multiple neighbors simultaneously)
- Snap visual guides during palette drag (SnapGuides.tsx only shows during Shift+drag)
