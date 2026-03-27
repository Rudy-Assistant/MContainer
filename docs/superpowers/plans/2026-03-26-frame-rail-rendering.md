# Frame Rail Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render 3D horizontal rail meshes connecting adjacent poles in frame mode, with material reactivity, hover/click interaction, and visibility overrides.

**Architecture:** A pure `computeRailPositions` function derives rail placement from existing `pillarPositions`. Rails render as horizontal cylinders after the pole block in ContainerSkin, using the same material resolution and interaction pattern as poles.

**Tech Stack:** React 19, Three.js, R3F, Zustand 5

**Spec:** `docs/superpowers/specs/2026-03-26-frame-phase3-rail-rendering-design.md`

---

### Task 1: Implement and test `computeRailPositions` pure function

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx` — add exported function + `FRAME_RAIL_R` constant
- Create: `src/__tests__/rail-positions.test.ts`

**Context you need to know:**
- `PolePosition` interface (from `smartPoles.ts`): `{ row, col, corner: 'ne'|'nw'|'se'|'sw', px, pz }`
- Corner → vertex mapping: `ne` of `(row,col)` → vertex `(row, col+1)`, `nw` → `(row, col)`, `se` → `(row+1, col+1)`, `sw` → `(row+1, col)`
- `makeRailKey(row, col, orientation)` from `frameMaterials.ts` returns e.g. `"r0c3_h"`
- `VOXEL_ROWS = 4`, `VOXEL_COLS = 8` from `types/container.ts`
- Existing constant `RAIL_R = 0.015` (line 171) is for surface railing cables. Frame rail constant must be named `FRAME_RAIL_R = 0.02`.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/rail-positions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeRailPositions, type RailPosition } from '@/components/objects/ContainerSkin';
import type { PolePosition } from '@/utils/smartPoles';

// Helper: create a PolePosition at a voxel corner
function pole(row: number, col: number, corner: 'ne' | 'nw' | 'se' | 'sw', px: number, pz: number): PolePosition {
  return { row, col, corner, px, pz };
}

describe('computeRailPositions', () => {
  it('RAIL-1: returns empty array for empty input', () => {
    expect(computeRailPositions([])).toEqual([]);
  });

  it('RAIL-2: returns empty array for single pole (no adjacent pair)', () => {
    const poles = [pole(0, 0, 'nw', 0, 0)];
    expect(computeRailPositions(poles)).toEqual([]);
  });

  it('RAIL-3: 4-corner box returns 2 horizontal + 2 vertical rails', () => {
    // Simple 1×1 box: 4 poles at corners of voxel (0,0)
    // Vertices: (0,0), (0,1), (1,0), (1,1)
    const poles = [
      pole(0, 0, 'nw', -1, -1),  // vertex (0,0)
      pole(0, 0, 'ne', 1, -1),   // vertex (0,1)
      pole(0, 0, 'sw', -1, 1),   // vertex (1,0)
      pole(0, 0, 'se', 1, 1),    // vertex (1,1)
    ];
    const rails = computeRailPositions(poles);
    const hRails = rails.filter(r => r.orientation === 'h');
    const vRails = rails.filter(r => r.orientation === 'v');
    // Horizontal: (0,0)→(0,1) and (1,0)→(1,1) = 2
    expect(hRails.length).toBe(2);
    // Vertical: (0,0)→(1,0) and (0,1)→(1,1) = 2
    expect(vRails.length).toBe(2);
  });

  it('RAIL-4: L-shaped poles (missing one corner) has no rail across gap', () => {
    // 3 poles forming an L: (0,0), (0,1), (1,0) — missing (1,1)
    const poles = [
      pole(0, 0, 'nw', -1, -1),  // vertex (0,0)
      pole(0, 0, 'ne', 1, -1),   // vertex (0,1)
      pole(0, 0, 'sw', -1, 1),   // vertex (1,0)
    ];
    const rails = computeRailPositions(poles);
    // H: (0,0)→(0,1) exists. (1,0)→(1,1) missing (no vertex at (1,1))
    // V: (0,0)→(1,0) exists. (0,1)→(1,1) missing (no vertex at (1,1))
    expect(rails.length).toBe(2);
    expect(rails.every(r => r.key.includes('c0'))).toBe(true); // both on col 0 boundary
  });

  it('RAIL-5: duplicate poles at same vertex are deduplicated', () => {
    // Two poles that map to the same vertex (0,1): ne of (0,0) and nw of (0,1)
    const poles = [
      pole(0, 0, 'nw', -1, -1),  // vertex (0,0)
      pole(0, 0, 'ne', 1, -1),   // vertex (0,1)
      pole(0, 1, 'nw', 1, -1),   // also vertex (0,1) — duplicate
    ];
    const rails = computeRailPositions(poles);
    // Only 1 horizontal rail: (0,0)→(0,1)
    expect(rails.filter(r => r.orientation === 'h').length).toBe(1);
  });

  it('RAIL-6: each rail has correct endpoint positions', () => {
    const poles = [
      pole(0, 0, 'nw', -3, -1),  // vertex (0,0)
      pole(0, 0, 'ne', 3, -1),   // vertex (0,1)
    ];
    const rails = computeRailPositions(poles);
    expect(rails.length).toBe(1);
    expect(rails[0].px1).toBe(-3);
    expect(rails[0].pz1).toBe(-1);
    expect(rails[0].px2).toBe(3);
    expect(rails[0].pz2).toBe(-1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/rail-positions.test.ts`
Expected: FAIL — `computeRailPositions` is not exported from ContainerSkin

- [ ] **Step 3: Add `FRAME_RAIL_R` constant and `RailPosition` interface**

In `src/components/objects/ContainerSkin.tsx`, after `const RAIL_R = 0.015;` (line 171), add:

```ts
const FRAME_RAIL_R = 0.02;  // structural frame rail radius (thinner than poles, thicker than cable railings)
```

And export the `RailPosition` interface. Add near the top of the file (after imports, before component code):

```ts
export interface RailPosition {
  key: string;
  px1: number;
  pz1: number;
  px2: number;
  pz2: number;
  orientation: 'h' | 'v';
}
```

- [ ] **Step 4: Implement `computeRailPositions`**

Add as an exported pure function (place after the constants, before component code):

```ts
/**
 * Compute rail positions from existing pole positions.
 * A rail renders only if BOTH endpoint poles exist.
 * Pure function — no store access, testable in isolation.
 */
export function computeRailPositions(poles: PolePosition[]): RailPosition[] {
  // Build vertex lookup: "vr_vc" → { px, pz }
  const vertexMap = new Map<string, { px: number; pz: number }>();
  for (const p of poles) {
    let vr: number, vc: number;
    switch (p.corner) {
      case 'ne': vr = p.row;     vc = p.col + 1; break;
      case 'nw': vr = p.row;     vc = p.col;     break;
      case 'se': vr = p.row + 1; vc = p.col + 1; break;
      case 'sw': vr = p.row + 1; vc = p.col;     break;
    }
    const key = `${vr}_${vc}`;
    if (!vertexMap.has(key)) vertexMap.set(key, { px: p.px, pz: p.pz });
  }

  const rails: RailPosition[] = [];

  // Horizontal rails: vertex (vr, c) → (vr, c+1)
  for (const [key, pos] of vertexMap) {
    const [vrStr, vcStr] = key.split('_');
    const vr = Number(vrStr);
    const vc = Number(vcStr);
    const rightKey = `${vr}_${vc + 1}`;
    const rightPos = vertexMap.get(rightKey);
    if (rightPos) {
      rails.push({
        key: makeRailKey(vr, vc, 'h'),
        px1: pos.px, pz1: pos.pz,
        px2: rightPos.px, pz2: rightPos.pz,
        orientation: 'h',
      });
    }
  }

  // Vertical rails: vertex (r, vc) → (r+1, vc)
  for (const [key, pos] of vertexMap) {
    const [vrStr, vcStr] = key.split('_');
    const vr = Number(vrStr);
    const vc = Number(vcStr);
    const belowKey = `${vr + 1}_${vc}`;
    const belowPos = vertexMap.get(belowKey);
    if (belowPos) {
      rails.push({
        key: makeRailKey(vr, vc, 'v'),
        px1: pos.px, pz1: pos.pz,
        px2: belowPos.px, pz2: belowPos.pz,
        orientation: 'v',
      });
    }
  }

  return rails;
}
```

Also add `PolePosition` import at the top:
```ts
import type { PolePosition } from '@/utils/smartPoles';
```

- [ ] **Step 5: Update existing import to include `makeRailKey`**

Find line 72:
```ts
// Before:
import { makePoleKey, resolveFrameProperty } from "@/config/frameMaterials";

// After:
import { makePoleKey, makeRailKey, resolveFrameProperty } from "@/config/frameMaterials";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/rail-positions.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 7: Run full type check + test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx src/__tests__/rail-positions.test.ts
git commit -m "feat: add computeRailPositions pure function with tests"
```

---

### Task 2: Add rail rendering block with material reactivity

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx` — add `railPositions` useMemo + rendering block after poles (~line 3492)

**Context you need to know:**
- `pillarPositions` is computed at line 2273 via `useMemo` inside `ContainerSkin` component.
- The pole rendering block is at lines 3442-3492. Rail block goes immediately after, before the pool water plane (line 3494).
- `vHeight` (line 2237) = container height. `vOffset` (line 2241) = `vHeight / 2`. Rails sit at Y = `vHeight` in local space.
- For the pole suppression guard: poles have `!(container.supporting?.length === 0 && containerY > 0)`. Rails should use the same guard.
- `getCyl(radius, length)` returns a Y-axis `CylinderGeometry`. Horizontal rails need rotation: h-rails → `[0, 0, Math.PI / 2]`, v-rails → `[Math.PI / 2, 0, 0]`.
- `container.railOverrides?.[key]` gives per-rail override config.
- `container.frameDefaults` gives container-level defaults.
- `resolveFrameProperty(override, defaults, 'rail', 'material')` resolves the material name.
- `getFrameThreeMaterial(name, currentTheme)` maps name to Three.js material.
- `selectedFrameElement` from the store tracks which frame element (pole or rail) is selected.
- `frameSelectMat` (line 302) is the yellow selection material.

- [ ] **Step 1: Add `railPositions` useMemo**

In `src/components/objects/ContainerSkin.tsx`, immediately after the `pillarPositions` useMemo closing (around line 2330 — find the closing of that useMemo), add:

```ts
  const railPositions = useMemo(() => computeRailPositions(pillarPositions), [pillarPositions]);
```

- [ ] **Step 2: Add rail rendering block after poles**

After the pole block closing `})}` at line 3492, add:

```tsx
      {/* Frame rails — horizontal members connecting adjacent poles */}
      {!(container.supporting?.length === 0 && containerY > 0) && railPositions.map((rail) => {
        const railOverride = container.railOverrides?.[rail.key];
        if (railOverride?.visible === false) return null;
        const isSelectedRail = selectedFrameElement?.containerId === container.id && selectedFrameElement.key === rail.key;
        const resolvedRailMatName = resolveFrameProperty(railOverride, container.frameDefaults, 'rail', 'material');
        const resolvedRailMaterial = getFrameThreeMaterial(resolvedRailMatName, currentTheme);
        const railMat = isSelectedRail ? frameSelectMat : resolvedRailMaterial;
        const length = Math.hypot(rail.px2 - rail.px1, rail.pz2 - rail.pz1);
        const midX = (rail.px1 + rail.px2) / 2;
        const midZ = (rail.pz1 + rail.pz2) / 2;
        const railRot: [number, number, number] = rail.orientation === 'h'
          ? [0, 0, Math.PI / 2]
          : [Math.PI / 2, 0, 0];
        return (
          <mesh
            key={`rail_${rail.key}`}
            position={[midX, vHeight, midZ]}
            rotation={railRot}
            geometry={getCyl(FRAME_RAIL_R, length)}
            material={railMat}
            castShadow
            raycast={frameMode ? undefined : nullRaycast}
            onClick={frameMode ? (e) => { e.stopPropagation(); setSelectedFrameElement({ containerId: container.id, key: rail.key, type: 'rail' }); } : undefined}
          />
        );
      })}
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx
git commit -m "feat: render frame rail meshes with material reactivity"
```

---

### Task 3: Add rail hover/click interaction

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx` — add `hoveredRailRef`, wire pointer handlers

**Context you need to know:**
- `hoveredPoleRef` (line 2146) uses `useRef<{ mesh: THREE.Mesh; material: THREE.Material } | null>(null)`. Rails need a separate `hoveredRailRef` with the same type.
- The hover pattern: `onPointerOver` applies `frameHoverMat`, stores the previous material in the ref. `onPointerOut` restores from the ref. Cross-element reset (hover from one rail to another) also restores via the ref.
- `frameHoverMat` (line 299) is the cyan hover material.

- [ ] **Step 1: Add `hoveredRailRef`**

In `src/components/objects/ContainerSkin.tsx`, immediately after `hoveredPoleRef` (line 2146), add:

```ts
  const hoveredRailRef = useRef<{ mesh: THREE.Mesh; material: THREE.Material } | null>(null);
```

- [ ] **Step 2: Add pointer handlers to rail mesh**

In the rail rendering block (from Task 2), update the `<mesh>` element to add `onPointerOver` and `onPointerOut`. Replace the simple `<mesh>` with:

```tsx
          <mesh
            key={`rail_${rail.key}`}
            position={[midX, vHeight, midZ]}
            rotation={railRot}
            geometry={getCyl(FRAME_RAIL_R, length)}
            material={railMat}
            castShadow
            raycast={frameMode ? undefined : nullRaycast}
            onPointerOver={frameMode ? (e) => {
              e.stopPropagation();
              const mesh = e.object as THREE.Mesh;
              if (hoveredRailRef.current && hoveredRailRef.current.mesh !== mesh) {
                hoveredRailRef.current.mesh.material = hoveredRailRef.current.material;
              }
              hoveredRailRef.current = { mesh, material: resolvedRailMaterial };
              if (!isSelectedRail) mesh.material = frameHoverMat;
            } : undefined}
            onPointerOut={frameMode ? (e) => {
              const mesh = e.object as THREE.Mesh;
              if (hoveredRailRef.current?.mesh === mesh) hoveredRailRef.current = null;
              if (!isSelectedRail) mesh.material = resolvedRailMaterial;
            } : undefined}
            onClick={frameMode ? (e) => { e.stopPropagation(); setSelectedFrameElement({ containerId: container.id, key: rail.key, type: 'rail' }); } : undefined}
          />
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx
git commit -m "feat: add rail hover/click interaction in frame mode"
```

---

### Task 4: Browser verification

**Context:** All code changes are complete. Verify in the browser.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Server starts on localhost:3000

- [ ] **Step 2: Verify rails render in frame mode**

1. Load app, click a container to select it
2. Open grid (Show grid icon), click "Frame" tab
3. Rails should be visible as thin horizontal cylinders connecting poles at roof height
4. Rails should connect every pair of adjacent poles — forming the structural grid

- [ ] **Step 3: Verify rail interaction**

1. Hover a rail → cyan highlight appears
2. Move away → highlight clears, original material restores
3. Click a rail → FrameInspector shows rail controls (material/shape)
4. Move cursor from one rail to another → first rail restores correctly

- [ ] **Step 4: Verify rail material reactivity**

1. In FrameInspector, change "Rail Material" to "Wood"
2. Rails should visually change to wood material
3. Change to "Aluminum" → rails change again

- [ ] **Step 5: Verify rails outside frame mode**

1. Exit frame mode (click "Exit Frame Mode" or toggle Frame tab off)
2. Rails should still be visible (they render in both modes)
3. But hover/click should NOT work outside frame mode (nullRaycast)

- [ ] **Step 6: Verify frame mode view isolation**

1. Enter frame mode
2. Walls/ceiling hidden, floor visible, poles + rails visible
3. Rails connect poles correctly in the exposed frame structure

- [ ] **Step 7: Final test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 8: Commit**

```bash
git commit --allow-empty -m "chore: frame rail rendering verification complete"
```
