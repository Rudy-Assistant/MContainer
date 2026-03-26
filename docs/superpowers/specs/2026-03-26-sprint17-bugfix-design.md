# Design Spec: Sprint 17 Bug Fixes

**Date:** 2026-03-26
**Scope:** 4 bugs from Sprint 17 handoff
**Order:** #4 → #3 → #2 → #1 (smallest first, dependencies respected)

---

## Sprint Items

| # | Priority | Item | Type | Complexity |
|---|----------|------|------|------------|
| 4 | P0 | Shift+click camera race condition | Bug | Low |
| 3 | P0 | Sticky alignment snap too loose | Bug | Medium |
| 2 | P0 | Adjacent container removes entire wall | Bug | Medium |
| 1 | P1 | Stack UI discoverability | Bug/UX | Low |

---

## 4. Shift+Click Camera Race Condition

### Problem

Camera disabling on Shift uses a `keydown` event listener (Scene.tsx ~line 1209). If the user clicks before the `keydown` fires, CameraControls processes the pointer event first, causing unintended camera rotation or pan alongside the intended container interaction.

The current mitigation:
```ts
isShiftHeldRef = useRef(false);
// keydown → isShiftHeldRef = true → sync() → camera.enabled = false
```

This is reactive — two sequential events (keydown + pointerdown) rather than one atomic gesture check.

Additionally, if a camera drag is in-progress when Shift is pressed, `camera.enabled = false` stops new input but doesn't abort the active drag (drei's CameraControls retains momentum).

### Root Cause

Shift detection happens via `window.addEventListener('keydown')` which fires asynchronously. The `pointerdown` event on the canvas can arrive before or simultaneously with the keydown, creating a race.

### Design

1. **Add pointer-level Shift check** — Add a `pointerdown` listener on the GL canvas (`gl.domElement`) that checks `e.shiftKey` and immediately sets `cameraControlsRef.current.enabled = false`. This catches Shift+click as one atomic gesture regardless of keydown timing.

2. **Stop accepting input immediately** — Setting `cameraControlsRef.current.enabled = false` is sufficient to stop processing new pointer input. Do NOT call `reset(false)` — it teleports the camera to its last saved position, causing a jarring jump. The camera-controls library does not have significant momentum when `smoothTime` is small (Scene.tsx uses 0.15), so disabling is enough.

3. **Re-sync on pointerup** — Add a `pointerup` listener that calls `sync()` to re-evaluate camera enabled state. This ensures camera re-enables after Shift+drag completes.

4. **Keep existing keydown/keyup listeners** — They still serve a purpose for Shift-hold-without-click scenarios (e.g., Shift held to show snapping guides in future).

### Files

- `Scene.tsx` — Shift key effect (~lines 1209-1229), add pointerdown/pointerup on `gl.domElement`

### Tests

- Browser: Shift+click container → no camera rotation, drag initiates cleanly
- Browser: rotate camera, press Shift mid-rotation → camera stops immediately
- Browser: click without Shift → camera orbit works normally (no regression)

---

## 3. Sticky Alignment Snap Too Loose

### Problem

`findEdgeSnap` in `spatialEngine.ts` (line 286) has a default `snapDistance = 1.5` meters. At 1.5m (~5 feet), containers snap when nowhere near flush — the snap feels jumpy and imprecise. Users expect a tight magnetic snap when containers are nearly touching.

V2 has a `stickySnap.ts` with `STICKY_THRESHOLD = 0.3m` but it was never ported to V1.

### Root Cause

The `snapDistance` parameter defaults to 1.5m (line 293 of spatialEngine.ts). All callers use the default:
- `addContainer()` smart placement (containerSlice.ts:328)
- `DragMoveGhost` during drag (Scene.tsx:1671)

### Design

1. **Reduce default `snapDistance`** from 1.5m → 0.3m in the `findEdgeSnap` function signature. This makes the snap feel tight and magnetic — containers only snap when nearly touching.

2. **Tighten existing center-alignment snap** — `findEdgeSnap` already has center-alignment logic at lines 362-382 with a 2.0m threshold. This existing block must be **replaced** (not supplemented) with the tighter 0.3m threshold. The existing code snaps Z-center when X-edge-snapping and X-center when Z-edge-snapping — this pattern is correct, only the threshold needs tightening from 2.0m → 0.3m.

   **Important:** Do NOT add a second alignment block alongside the existing one. Replace the `2.0` constant in the existing center-alignment logic with `0.3`. Adding a parallel block creates two competing behaviors.

3. **No V2 port** — V1's `findEdgeSnap` already handles the 4 cardinal snap scenarios + center alignment correctly. Only the thresholds need tightening.

### Files

- `spatialEngine.ts` — `findEdgeSnap` function (~lines 286-387): change default param, add center alignment logic

### Tests

- Unit test: `findEdgeSnap` with containers 0.2m apart → snaps (< 0.3m threshold)
- Unit test: `findEdgeSnap` with containers 0.5m apart → no snap (> 0.3m threshold)
- Unit test: edge snap with Z-center offset 0.15m → Z snaps to align
- Browser: drag container near edge of another → snaps flush at ~0.3m proximity
- Browser: drag container near edge, slightly offset in Z → snaps both flush AND row-aligned

---

## 2. Adjacent Container Removes Entire Wall

### Problem

When two containers are placed side-by-side, the entire shared wall disappears instead of only the overlapping voxel faces. Users see a complete wall removed on both containers.

### Root Cause (two issues)

**Issue A — Adjacency tolerance too loose:**
`ADJACENCY_TOLERANCE = 0.15` in `spatialEngine.ts` (used in `findAdjacentPairs`). Containers 15cm apart trigger adjacency detection even though they're not touching. Should be ≤3cm for "touching."

**Issue B — Voxel overlap check too generous:**
In `mergeBoundaryVoxels` (containerSlice.ts ~lines 1507-1557), the overlap test checks if a voxel's **center** falls within the other container's extent **plus tolerance**:
```
aWorldZ within [b.position.z - bHalfZ - tolerance, b.position.z + bHalfZ + tolerance]
```
With `tolerance = rowPitch/2 ≈ 0.75m`, this extends the acceptance window so wide that ALL boundary voxels "overlap" even when their physical extents don't intersect.

Same issue exists in `computeGlobalCulling` (spatialEngine.ts ~lines 546-663) which uses similar loose overlap logic for render-time face culling.

### Design

1. **Tighten `ADJACENCY_TOLERANCE`** from 0.15m → 0.03m. Only containers within 3cm trigger adjacency.

2. **Fix overlap check in `mergeBoundaryVoxels`** — Replace the center-in-extended-bounds check with a proper geometric intersection test:
   ```
   // Current (broken): center within extended bounds
   aWorldZ in [bMin - tolerance, bMax + tolerance]

   // Fixed: actual voxel extents must overlap by >50%
   aVoxelMin = aWorldZ - aVoxelHalfWidth
   aVoxelMax = aWorldZ + aVoxelHalfWidth
   bExtentMin = bMin  // no tolerance extension
   bExtentMax = bMax
   overlapAmount = min(aVoxelMax, bExtentMax) - max(aVoxelMin, bExtentMin)
   overlaps = overlapAmount > aVoxelWidth * 0.5
   ```
   This ensures only voxels whose physical footprints genuinely intersect get merged.

3. **Extract shared overlap predicate** — Both `mergeBoundaryVoxels` and `computeGlobalCulling` must use the exact same overlap test. Extract the geometric intersection logic into a shared helper function (e.g., `voxelExtentsOverlap(aCenter, aWidth, bMin, bMax): boolean`) in `spatialEngine.ts`. Both callers import and use this single function. This prevents the two implementations from drifting and causing visual artifacts where faces are merged but not culled, or vice versa.

4. **Apply shared predicate to `computeGlobalCulling`** — Replace the loose overlap check in `tryCullPair` (spatialEngine.ts ~lines 624-627) with the same `voxelExtentsOverlap` helper.

5. **Preserve `_preMergeWalls` restore** — The existing save/restore mechanism for undo is correct and should not change.

**Note on floating-point precision:** After tightening `ADJACENCY_TOLERANCE` to 0.03m, perfectly edge-snapped containers (gap = 0) will still be detected since 0 < 0.03. If floating-point drift produces a gap of 0.031m, adjacency would be missed. This is low risk since snap positions are quantized, but implementers should be aware.

### Files

- `spatialEngine.ts` — `ADJACENCY_TOLERANCE` constant, `computeGlobalCulling` overlap logic
- `containerSlice.ts` — `mergeBoundaryVoxels` overlap check (~lines 1507-1557)

### Tests

- Unit test: `findAdjacentPairs` with containers 0.02m apart → detected as adjacent
- Unit test: `findAdjacentPairs` with containers 0.05m apart → NOT adjacent
- Unit test: merge with partial voxel overlap (2 of 4 rows) → only 2 voxels merged, not 4
- Unit test: merge with full voxel overlap (same-size containers aligned) → all boundary voxels merged
- Browser: place 20ft next to 40ft (different widths) → only overlapping voxels merge, rest of wall intact
- Browser: place two 40ft HC side-by-side (same width) → full wall merge (correct — they fully overlap)

---

## 1. Stack UI Discoverability

### Problem

Drag-to-stack is fully implemented (findStackTarget → ghostPos.stackTargetId → commitContainerDrag → stackContainer) but users don't discover it. The `StackTargetIndicator` wireframe alone doesn't communicate "drop here to stack." The sidebar "⬆" button works but is non-obvious.

### Root Cause

No visual feedback distinguishing "hovering over stackable target" from "just dragging near a container." The wireframe indicator is subtle and unlabeled.

### Design

1. **Green highlight when stack eligible** — `StackTargetIndicator` (Scene.tsx ~line 1732) already renders a wireframe with `HIGHLIGHT_COLOR_SELECT` (cyan) and an `<Html>` label reading "Stack Here" at line 1769. Change the wireframe color from `HIGHLIGHT_COLOR_SELECT` to green (`0x22c55e`) and add emissive glow (`emissive: 0x22c55e, emissiveIntensity: 0.3`).

2. **Update existing label text** — Change the existing `<Html>` label text from "Stack Here" to "Release to stack" for clearer affordance. Do NOT add a second `<Html>` label — one already exists at line 1769.

3. **Lower overlap threshold** — In `findStackTarget` (spatialEngine.ts ~line 406), lower the footprint overlap requirement from 60% → 40%. This makes it easier to discover drag-to-stack without requiring near-perfect alignment.

### Files

- `Scene.tsx` — `StackTargetIndicator` rendering (~lines 1732-1758): add green material + Html label
- `spatialEngine.ts` — `findStackTarget` overlap threshold (~line 406)

### Tests

- Browser: drag container over another with 45% overlap → green wireframe + "Release to stack" label appears
- Browser: release → containers stack correctly
- Browser: drag away (< 40% overlap) → indicator disappears
- Browser: use sidebar ⬆ button → still works as before

---

## Critical Invariants (from handoff)

These must not be violated during implementation:

1. **Never mutate refs inside Zustand selectors** — causes render loop crashes
2. **`selectedFace` is orthogonal to `selectedElements`** — `setSelectedElements` must NOT clear `selectedFace` unless sel is null
3. **MatrixEditor owns the spatial grid** — all voxel layout calculations go through `getVoxelLayout`
4. **PresetCard convention** — square image area, highlight on image only, label below
5. **Zustand selectors with middleware** — no `equalityFn` 2nd arg; use `useShallow` + `useRef` dedup
6. **Floor-based hitbox paradigm** — vertical wall meshes use `raycast={nullRaycast}`

## Verification Plan

For each item:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all tests pass
3. Browser verification per item's specific checks
4. Final full walkthrough after all 4 items complete
