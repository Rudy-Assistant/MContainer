# Sprint 17 Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 Sprint 17 bugs: Shift+click camera race, sticky snap threshold, adjacent wall over-merge, stack UI discoverability.

**Architecture:** All fixes are in `spatialEngine.ts` (snap/adjacency/stack logic), `containerSlice.ts` (merge logic), and `Scene.tsx` (camera/UI). A shared `voxelExtentsOverlap` helper is extracted to spatialEngine for both merge and cull paths.

**Tech Stack:** React 19, Three.js, Zustand 5, R3F, drei CameraControls

**Spec:** `docs/superpowers/specs/2026-03-26-sprint17-bugfix-design.md`

---

### Task 1: Fix Shift+click camera race condition

**Files:**
- Modify: `src/components/three/Scene.tsx` (lines 1199-1229 — RealisticScene, Shift key effect)

**Context you need to know:**
- `RealisticScene` (line 1199) is a component inside the R3F `<Canvas>` tree. `useThree()` is available.
- `cameraControlsRef` (line 1208) is a `useRef<CameraControlsImpl>(null)` for the drei CameraControls.
- `isShiftHeldRef` (line 1209) tracks Shift key state.
- The `useEffect` at line 1213 adds `keydown`/`keyup` listeners on `window` and a Zustand subscription.
- The `sync()` function at line 1214 imperatively sets `cameraControlsRef.current.enabled`.
- The race: `pointerdown` can fire before/simultaneously with `keydown`, so Shift+click may not disable camera in time.

- [ ] **Step 1: Add `useThree` import for gl access**

In `src/components/three/Scene.tsx`, inside `RealisticScene` (line 1199), add `gl` to the destructured values from an existing `useThree` call, or add a new one near line 1209. Since `useThree` is already imported at line 5, just add:

```ts
const gl = useThree((s) => s.gl);
```

Place this immediately after `const isShiftHeldRef = useRef(false);` (after line 1209).

- [ ] **Step 2: Add pointerdown/pointerup listeners to canvas**

Expand the existing `useEffect` (line 1213) to also add pointer-level Shift detection on `gl.domElement`. Add these handlers inside the effect, after the `sync` function definition:

```ts
    const pdown = (e: PointerEvent) => {
      if (e.shiftKey) {
        isShiftHeldRef.current = true;
        sync();
      }
    };
    const pup = () => {
      // Re-sync on pointer up — camera re-enables if Shift is released
      sync();
    };
```

Then register them on `gl.domElement`:

```ts
    gl.domElement.addEventListener('pointerdown', pdown);
    gl.domElement.addEventListener('pointerup', pup);
```

And update the cleanup return:

```ts
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      gl.domElement.removeEventListener('pointerdown', pdown);
      gl.domElement.removeEventListener('pointerup', pup);
      unsub();
    };
```

Add `gl.domElement` to the dependency array: `}, [gl.domElement]);`

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/three/Scene.tsx
git commit -m "fix: add pointer-level Shift detection to prevent camera race condition"
```

---

### Task 2: Tighten edge snap and center-alignment thresholds

**Files:**
- Modify: `src/store/spatialEngine.ts` (lines 286-387 — `findEdgeSnap`)
- Create: `src/__tests__/edge-snap.test.ts`

**Context you need to know:**
- `findEdgeSnap` (line 286) takes `snapDistance: number = 1.5` as default param.
- Lines 362-372 have center-alignment logic with a `2.0` threshold. This block must be **replaced** (threshold changed to 0.3), not supplemented with a second block.
- The function is called from `addContainer()` smart placement (containerSlice.ts:328) and `DragMoveGhost` (Scene.tsx:1671), both using the default.
- `CONTAINER_DIMENSIONS` maps container sizes to `{ length, width, height }`.
- `getFootprint(c)` returns `{ minX, maxX, minZ, maxZ }` for a placed container.
- `getFootprintAt(x, z, size, rotation?)` returns footprint at arbitrary position.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/edge-snap.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { findEdgeSnap } from '@/store/spatialEngine';
import { ContainerSize } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('findEdgeSnap threshold', () => {
  let containers: Record<string, any>;

  beforeEach(() => {
    resetStore();
    // Place a container at origin
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    containers = useStore.getState().containers;
  });

  it('SNAP-1: snaps when edge gap is 0.2m (within 0.3m threshold)', () => {
    // HC40 half-length ≈ 6.096, so right edge at x ≈ 6.096
    // Place new container with left edge 0.2m away from right edge
    const result = findEdgeSnap(containers, null, 12.4, 0, ContainerSize.HighCube40);
    expect(result.snapped).toBe(true);
  });

  it('SNAP-2: does NOT snap when edge gap is 0.5m (outside 0.3m threshold)', () => {
    const result = findEdgeSnap(containers, null, 13.0, 0, ContainerSize.HighCube40);
    expect(result.snapped).toBe(false);
  });

  it('SNAP-3: center-alignment snaps Z when offset is 0.15m', () => {
    // Place new container flush X-wise, offset 0.15m in Z
    const result = findEdgeSnap(containers, null, 12.2, 0.15, ContainerSize.HighCube40);
    if (result.snapped) {
      expect(result.z).toBe(0); // Should align Z center
    }
  });

  it('SNAP-4: center-alignment does NOT snap Z when offset is 0.5m', () => {
    const result = findEdgeSnap(containers, null, 12.2, 0.5, ContainerSize.HighCube40);
    if (result.snapped) {
      expect(result.z).not.toBe(0); // Should NOT force Z alignment
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/edge-snap.test.ts`
Expected: SNAP-2 FAILS (currently snaps at 0.5m because default is 1.5m), SNAP-4 FAILS (currently aligns at 0.5m because threshold is 2.0m)

- [ ] **Step 3: Change default snapDistance from 1.5 → 0.3**

In `src/store/spatialEngine.ts`, find line 293:

```ts
// Before:
  snapDistance: number = 1.5

// After:
  snapDistance: number = 0.3
```

- [ ] **Step 4: Change center-alignment threshold from 2.0 → 0.3**

In `src/store/spatialEngine.ts`, find lines 365 and 369:

```ts
// Before (line 365):
      if (Math.abs(bestZ - zAlign) < 2.0) {

// After:
      if (Math.abs(bestZ - zAlign) < 0.3) {
```

```ts
// Before (line 369):
      if (Math.abs(bestX - xAlign) < 2.0) {

// After:
      if (Math.abs(bestX - xAlign) < 0.3) {
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/edge-snap.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 6: Run full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/store/spatialEngine.ts src/__tests__/edge-snap.test.ts
git commit -m "fix: tighten edge snap threshold from 1.5m to 0.3m and center alignment from 2.0m to 0.3m"
```

---

### Task 3: Fix adjacent wall over-merge — extract shared overlap predicate

**Files:**
- Modify: `src/store/spatialEngine.ts` (line 428 — ADJACENCY_TOLERANCE, lines 600-660 — computeGlobalCulling)
- Modify: `src/store/slices/containerSlice.ts` (lines 1537-1557 — overlap check in refreshAdjacency)
- Create: `src/__tests__/adjacency-merge.test.ts`

**Context you need to know:**
- `ADJACENCY_TOLERANCE = 0.15` (line 428 of spatialEngine.ts). Used in `findAdjacentPairs` (lines 438-511).
- `refreshAdjacency` (containerSlice.ts line 1434) calls `findAdjacentPairs`, then iterates over pairs to merge boundary voxels.
- The overlap check at lines 1537-1557 uses `center ± pitch/2` tolerance — too generous.
- `computeGlobalCulling` (spatialEngine.ts lines 580-663) has the identical loose overlap at lines 624-627.
- Both must use the same predicate to prevent merge/cull divergence.
- `VOXEL_ROWS = 4`, `VOXEL_COLS = 8`, `VOXEL_LEVELS = 2`.
- For HC40: `length = 12.192m, width = 2.438m` → `colPitch = 12.192/6 ≈ 2.032`, `rowPitch = 2.438/2 = 1.219`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/adjacency-merge.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { findAdjacentPairs, voxelExtentsOverlap } from '@/store/spatialEngine';
import { ContainerSize, CONTAINER_DIMENSIONS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('ADJACENCY_TOLERANCE', () => {
  beforeEach(() => resetStore());

  it('ADJ-1: detects adjacency at 0.02m gap', () => {
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    // Place second container flush + 0.02m gap
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, {
      x: dims.length + 0.02, y: 0, z: 0,
    }, 0, true); // level=0, skipSmartPlacement=true
    const containers = useStore.getState().containers;
    const pairs = findAdjacentPairs(containers);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
  });

  it('ADJ-2: does NOT detect adjacency at 0.05m gap', () => {
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, {
      x: dims.length + 0.05, y: 0, z: 0,
    }, true);
    const containers = useStore.getState().containers;
    const pairs = findAdjacentPairs(containers);
    expect(pairs.length).toBe(0);
  });
});

describe('voxelExtentsOverlap', () => {
  it('ADJ-3: returns true when voxel fully inside container extent', () => {
    expect(voxelExtentsOverlap(0, 1.2, -2, 2)).toBe(true);
  });

  it('ADJ-4: returns true when voxel overlaps >50% of its width', () => {
    // Voxel center=1.5, halfWidth=0.6, extent=[0.9, 2.1]. Container extent=[0, 2].
    // Overlap = min(2.1, 2) - max(0.9, 0) = 2 - 0.9 = 1.1. VoxelWidth=1.2. 1.1/1.2 > 0.5 ✓
    expect(voxelExtentsOverlap(1.5, 1.2, 0, 2)).toBe(true);
  });

  it('ADJ-5: returns false when voxel overlaps <50% of its width', () => {
    // Voxel center=2.5, halfWidth=0.6, extent=[1.9, 3.1]. Container extent=[0, 2].
    // Overlap = min(3.1, 2) - max(1.9, 0) = 2 - 1.9 = 0.1. VoxelWidth=1.2. 0.1/1.2 < 0.5 ✗
    expect(voxelExtentsOverlap(2.5, 1.2, 0, 2)).toBe(false);
  });

  it('ADJ-6: returns false when voxel completely outside extent', () => {
    expect(voxelExtentsOverlap(5, 1.2, 0, 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/adjacency-merge.test.ts`
Expected: ADJ-2 FAILS (0.05m still detected with 0.15 tolerance), ADJ-3 through ADJ-6 FAIL (`voxelExtentsOverlap` doesn't exist yet)

- [ ] **Step 3: Add `voxelExtentsOverlap` helper to spatialEngine.ts**

In `src/store/spatialEngine.ts`, add before `findAdjacentPairs` (before line 428):

```ts
/**
 * Check if a voxel's physical extent overlaps a container's extent by >50%.
 * Used by both mergeBoundaryVoxels and computeGlobalCulling to ensure identical behavior.
 *
 * @param voxelCenter - World-space center of the voxel along the perpendicular axis
 * @param voxelWidth - Full width of the voxel (pitch, not half-pitch)
 * @param extentMin - Start of the other container's extent along the same axis
 * @param extentMax - End of the other container's extent along the same axis
 */
export function voxelExtentsOverlap(
  voxelCenter: number,
  voxelWidth: number,
  extentMin: number,
  extentMax: number,
): boolean {
  const vMin = voxelCenter - voxelWidth / 2;
  const vMax = voxelCenter + voxelWidth / 2;
  const overlap = Math.min(vMax, extentMax) - Math.max(vMin, extentMin);
  return overlap > voxelWidth * 0.5;
}
```

- [ ] **Step 4: Tighten ADJACENCY_TOLERANCE from 0.15 → 0.03**

In `src/store/spatialEngine.ts`, find line 428:

```ts
// Before:
const ADJACENCY_TOLERANCE = 0.15;

// After:
const ADJACENCY_TOLERANCE = 0.03;
```

- [ ] **Step 5: Run tests to verify ADJ-1 through ADJ-6 pass**

Run: `npx vitest run src/__tests__/adjacency-merge.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Replace overlap check in refreshAdjacency (containerSlice.ts)**

In `src/store/slices/containerSlice.ts`, add import at top:

```ts
import { voxelExtentsOverlap } from '@/store/spatialEngine';
```

Then find lines 1537-1557 (the overlap check block). Replace the col-boundary path (lines 1537-1546):

```ts
// Before:
            if (!aBound.isRowBoundary) {
              // Col boundary (Front/Back) — check Z overlap of this row
              const aWorldZ = a.position.z + (iter - 1.5) * aRowPitch;
              const bWorldZ = b.position.z + (iter - 1.5) * bRowPitch;
              const bHalfZ = (VOXEL_ROWS / 2) * bRowPitch;
              const aHalfZ = (VOXEL_ROWS / 2) * aRowPitch;
              const aTol = aRowPitch / 2;
              const bTol = bRowPitch / 2;
              aOverlaps = aWorldZ >= b.position.z - bHalfZ - aTol && aWorldZ <= b.position.z + bHalfZ + aTol;
              bOverlaps = bWorldZ >= a.position.z - aHalfZ - bTol && bWorldZ <= a.position.z + aHalfZ + bTol;

// After:
            if (!aBound.isRowBoundary) {
              // Col boundary (Front/Back) — check Z overlap of this row
              const aWorldZ = a.position.z + (iter - 1.5) * aRowPitch;
              const bWorldZ = b.position.z + (iter - 1.5) * bRowPitch;
              const bExtMinZ = b.position.z - (VOXEL_ROWS / 2) * bRowPitch;
              const bExtMaxZ = b.position.z + (VOXEL_ROWS / 2) * bRowPitch;
              const aExtMinZ = a.position.z - (VOXEL_ROWS / 2) * aRowPitch;
              const aExtMaxZ = a.position.z + (VOXEL_ROWS / 2) * aRowPitch;
              aOverlaps = voxelExtentsOverlap(aWorldZ, aRowPitch, bExtMinZ, bExtMaxZ);
              bOverlaps = voxelExtentsOverlap(bWorldZ, bRowPitch, aExtMinZ, aExtMaxZ);
```

And the row-boundary path (lines 1547-1557):

```ts
// Before:
            } else {
              // Row boundary (Left/Right) — check X overlap of this col
              const aWorldX = a.position.x + -(iter - 3.5) * aColPitch;
              const bWorldX = b.position.x + -(iter - 3.5) * bColPitch;
              const bHalfX = (VOXEL_COLS / 2) * bColPitch;
              const aHalfX = (VOXEL_COLS / 2) * aColPitch;
              const aTol = aColPitch / 2;
              const bTol = bColPitch / 2;
              aOverlaps = aWorldX >= b.position.x - bHalfX - aTol && aWorldX <= b.position.x + bHalfX + aTol;
              bOverlaps = bWorldX >= a.position.x - aHalfX - bTol && bWorldX <= a.position.x + aHalfX + bTol;
            }

// After:
            } else {
              // Row boundary (Left/Right) — check X overlap of this col
              const aWorldX = a.position.x + -(iter - 3.5) * aColPitch;
              const bWorldX = b.position.x + -(iter - 3.5) * bColPitch;
              const bExtMinX = b.position.x - (VOXEL_COLS / 2) * bColPitch;
              const bExtMaxX = b.position.x + (VOXEL_COLS / 2) * bColPitch;
              const aExtMinX = a.position.x - (VOXEL_COLS / 2) * aColPitch;
              const aExtMaxX = a.position.x + (VOXEL_COLS / 2) * aColPitch;
              aOverlaps = voxelExtentsOverlap(aWorldX, aColPitch, bExtMinX, bExtMaxX);
              bOverlaps = voxelExtentsOverlap(bWorldX, bColPitch, aExtMinX, aExtMaxX);
            }
```

- [ ] **Step 7: Replace overlap check in computeGlobalCulling (spatialEngine.ts)**

In `src/store/spatialEngine.ts`, find the col-boundary overlap (lines 622-627):

```ts
// Before:
          const aOvl = aWorldZ >= b.position.z - bHalfZ - aRowPitch / 2
                    && aWorldZ <= b.position.z + bHalfZ + aRowPitch / 2;
          const bOvl = bWorldZ >= a.position.z - aHalfZ - bRowPitch / 2
                    && bWorldZ <= a.position.z + aHalfZ + bRowPitch / 2;

// After:
          const bExtMinZ = b.position.z - bHalfZ;
          const bExtMaxZ = b.position.z + bHalfZ;
          const aExtMinZ = a.position.z - aHalfZ;
          const aExtMaxZ = a.position.z + aHalfZ;
          const aOvl = voxelExtentsOverlap(aWorldZ, aRowPitch, bExtMinZ, bExtMaxZ);
          const bOvl = voxelExtentsOverlap(bWorldZ, bRowPitch, aExtMinZ, aExtMaxZ);
```

Find the row-boundary overlap (lines 645-648):

```ts
// Before:
          const aOvl = aWorldX >= b.position.x - bHalfX - aColPitch / 2
                    && aWorldX <= b.position.x + bHalfX + aColPitch / 2;
          const bOvl = bWorldX >= a.position.x - aHalfX - bColPitch / 2
                    && bWorldX <= a.position.x + aHalfX + bColPitch / 2;

// After:
          const bExtMinX = b.position.x - bHalfX;
          const bExtMaxX = b.position.x + bHalfX;
          const aExtMinX = a.position.x - aHalfX;
          const aExtMaxX = a.position.x + aHalfX;
          const aOvl = voxelExtentsOverlap(aWorldX, aColPitch, bExtMinX, bExtMaxX);
          const bOvl = voxelExtentsOverlap(bWorldX, bColPitch, aExtMinX, aExtMaxX);
```

- [ ] **Step 8: Run full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/store/spatialEngine.ts src/store/slices/containerSlice.ts src/__tests__/adjacency-merge.test.ts
git commit -m "fix: tighten adjacency tolerance and use shared voxelExtentsOverlap predicate"
```

---

### Task 4: Stack UI discoverability — green indicator + label + lower threshold

**Files:**
- Modify: `src/components/three/Scene.tsx` (lines 1732-1786 — StackTargetIndicator)
- Modify: `src/store/spatialEngine.ts` (line 408 — findStackTarget overlap threshold)

**Context you need to know:**
- `StackTargetIndicator` (line 1732) renders a wireframe box + `<Html>` label when `ghostPos.stackTargetId` is set.
- The wireframe material uses `HIGHLIGHT_COLOR_SELECT` (cyan) at line 1767.
- The `<Html>` label at line 1769 says "Stack Here".
- `findStackTarget` (line 408) requires `overlap >= 0.6` (60%).
- The existing label and wireframe already exist — only color/text need changing.

- [ ] **Step 1: Change wireframe material to green with emissive glow**

In `src/components/three/Scene.tsx`, find line 1767:

```tsx
// Before:
        <meshBasicMaterial wireframe color={HIGHLIGHT_COLOR_SELECT} transparent opacity={0.8} />

// After:
        <meshStandardMaterial wireframe color={0x22c55e} emissive={0x22c55e} emissiveIntensity={0.3} transparent opacity={0.8} />
```

- [ ] **Step 2: Update label text from "Stack Here" to "Release to stack"**

Find line 1781:

```tsx
// Before:
          Stack Here

// After:
          Release to stack
```

- [ ] **Step 3: Lower findStackTarget overlap threshold from 0.6 → 0.4**

In `src/store/spatialEngine.ts`, find line 408:

```ts
// Before:
    if (overlap < 0.6) continue;

// After:
    if (overlap < 0.4) continue;
```

- [ ] **Step 4: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/three/Scene.tsx src/store/spatialEngine.ts
git commit -m "feat: improve stack UI — green indicator, clearer label, lower overlap threshold"
```

---

### Task 5: Browser verification

**Context:** All code changes are complete. Verify everything works in the browser.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on localhost:3000

- [ ] **Step 2: Verify Shift+click camera fix**

1. Load app, add a container
2. Hold Shift + click on container → should NOT rotate camera, should initiate drag
3. Orbit camera (left-drag without Shift) → should work normally
4. While orbiting, press Shift → camera should stop moving

- [ ] **Step 3: Verify edge snap threshold**

1. Drag a second container toward the first
2. When ~0.3m from flush edge → container should snap flush
3. When >0.3m away → no snap, free positioning
4. When snapped flush with slight Z offset → Z should align to match

- [ ] **Step 4: Verify adjacent wall merge**

1. Place two 40ft HC containers side-by-side (edge-snapped)
2. Same-size, same Z position → entire shared wall should merge (correct — full overlap)
3. Undo, place a 20ft next to a 40ft at same Z → only overlapping portion of wall should merge
4. Non-overlapping voxels should retain their wall

- [ ] **Step 5: Verify stack UI**

1. Drag a container over another with ~45% overlap
2. Green wireframe + "Release to stack" label should appear
3. Release → containers stack
4. Drag away (< 40% overlap) → indicator disappears
5. Use sidebar ⬆ button → still works

- [ ] **Step 6: Final full test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 7: Commit verification notes**

```bash
git commit --allow-empty -m "chore: Sprint 17 bugfix verification complete — all 4 fixes confirmed"
```
