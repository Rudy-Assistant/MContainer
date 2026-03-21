# Selection → Context → Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a derived `SelectionTarget` that drives hotbar auto-switching, persistent wall selection highlights, corrected preset cycle order, and actionable smart warnings.

**Architecture:** A pure `deriveSelectionTarget()` function computes a discriminated union from existing store state. A `useHotbarAutoSwitch()` hook watches type transitions and calls `setActiveHotbarTab()`. Wall selection highlights mirror the existing hover overlay system. Warning UI moves from inline inspector list to a compact toolbar badge with popover.

**Tech Stack:** React 19, Zustand 5, Three.js, Lucide React icons

**Spec:** `docs/superpowers/specs/2026-03-21-selection-context-interaction-design.md`

---

### Task 1: SelectionTarget Derivation — Pure Function + Tests

**Files:**
- Create: `src/hooks/useSelectionTarget.ts`
- Create: `src/Testing/selection-target.test.ts`

The derivation is a pure function with no React dependency. The hook wraps it with `useStore` + custom equality. Test the pure function first.

- [ ] **Step 1: Write the failing test**

```ts
// src/Testing/selection-target.test.ts
import { describe, it, expect } from 'vitest';
import { deriveSelectionTarget } from '../hooks/useSelectionTarget';

// Minimal store-shaped inputs for testing
const base = {
  selectedVoxel: null,
  selectedFace: null,
  selectedVoxels: null,
  selection: [],
};

describe('deriveSelectionTarget', () => {
  it('returns none when nothing selected', () => {
    expect(deriveSelectionTarget(base)).toEqual({ type: 'none' });
  });

  it('returns container when selection has containerId', () => {
    expect(deriveSelectionTarget({ ...base, selection: ['c1'] }))
      .toEqual({ type: 'container', containerId: 'c1' });
  });

  it('returns voxel for VoxelRef without face', () => {
    expect(deriveSelectionTarget({
      ...base,
      selectedVoxel: { containerId: 'c1', index: 5 },
    })).toEqual({ type: 'voxel', containerId: 'c1', index: 5 });
  });

  it('returns face for VoxelRef with face', () => {
    expect(deriveSelectionTarget({
      ...base,
      selectedVoxel: { containerId: 'c1', index: 5 },
      selectedFace: 'n',
    })).toEqual({ type: 'face', containerId: 'c1', index: 5, face: 'n' });
  });

  it('returns voxel for VoxelExtRef (converts col/row to index)', () => {
    // row=0, col=3 → index = 0*8+3 = 3
    expect(deriveSelectionTarget({
      ...base,
      selectedVoxel: { containerId: 'c1', isExtension: true as const, col: 3, row: 0 },
    })).toEqual({ type: 'voxel', containerId: 'c1', index: 3 });
  });

  it('returns bay for selectedVoxels without face', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedVoxels: { containerId: 'c1', indices: [9, 10, 17, 18] },
    });
    expect(result.type).toBe('bay');
    if (result.type === 'bay') {
      expect(result.containerId).toBe('c1');
      expect(result.indices).toEqual([9, 10, 17, 18]);
      expect(result.bayId).toBeDefined();
    }
  });

  it('returns bay-face for selectedVoxels with face', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedVoxels: { containerId: 'c1', indices: [9, 10, 17, 18] },
      selectedFace: 'e',
    });
    expect(result.type).toBe('bay-face');
    if (result.type === 'bay-face') {
      expect(result.face).toBe('e');
    }
  });

  it('selectedVoxels takes priority over selectedVoxel', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedVoxel: { containerId: 'c1', index: 0 },
      selectedVoxels: { containerId: 'c1', indices: [9, 10] },
    });
    expect(result.type).toBe('bay');
  });

  it('selectedVoxel takes priority over selection', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedVoxel: { containerId: 'c1', index: 5 },
      selection: ['c1'],
    });
    expect(result.type).toBe('voxel');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/selection-target.test.ts`
Expected: FAIL — module `../hooks/useSelectionTarget` does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useSelectionTarget.ts
import { useRef } from 'react';
import { useStore } from '../store/useStore';
import type { VoxelPayload } from '../store/useStore';
import type { VoxelFaces } from '../types/container';
import { VOXEL_COLS } from '../types/container';
import { getBayGroupForVoxel } from '../config/bayGroups';

// ── Types ────────────────────────────────────────────────────

export type FaceKey = keyof VoxelFaces;

export type SelectionTarget =
  | { type: 'none' }
  | { type: 'container'; containerId: string }
  | { type: 'voxel'; containerId: string; index: number }
  | { type: 'bay'; containerId: string; indices: number[]; bayId: string }
  | { type: 'face'; containerId: string; index: number; face: FaceKey }
  | { type: 'bay-face'; containerId: string; indices: number[]; bayId: string; face: FaceKey };

// ── Derivation input shape (subset of store state) ───────────

export interface SelectionState {
  selectedVoxel: VoxelPayload | null;
  selectedFace: FaceKey | null;
  selectedVoxels: { containerId: string; indices: number[] } | null;
  selection: string[];
}

// ── Pure derivation function ─────────────────────────────────

export function deriveSelectionTarget(state: SelectionState): SelectionTarget {
  // Priority 1: Multi-voxel selection (bay group or shift-click multi)
  if (state.selectedVoxels) {
    const cid = state.selectedVoxels.containerId;
    const indices = state.selectedVoxels.indices;
    // All indices in a bay group share the same bayId; use first to look up
    const bayId = getBayGroupForVoxel(indices[0])?.id ?? 'custom';
    if (state.selectedFace) {
      return { type: 'bay-face', containerId: cid, indices, bayId, face: state.selectedFace };
    }
    return { type: 'bay', containerId: cid, indices, bayId };
  }

  // Priority 2: Single voxel selection
  if (state.selectedVoxel) {
    const sv = state.selectedVoxel;
    if (sv.isExtension) {
      // VoxelExtRef: convert col/row to flat grid index
      const idx = sv.row * VOXEL_COLS + sv.col;
      const cid = sv.containerId;
      if (state.selectedFace) {
        return { type: 'face', containerId: cid, index: idx, face: state.selectedFace };
      }
      return { type: 'voxel', containerId: cid, index: idx };
    } else {
      // VoxelRef: has .index directly
      const cid = sv.containerId;
      const idx = sv.index;
      if (state.selectedFace) {
        return { type: 'face', containerId: cid, index: idx, face: state.selectedFace };
      }
      return { type: 'voxel', containerId: cid, index: idx };
    }
  }

  // Priority 3: Container-level selection
  if (state.selection.length > 0) {
    return { type: 'container', containerId: state.selection[0] };
  }

  return { type: 'none' };
}

// ── Equality function for selector stability ─────────────────

function selectionTargetEqual(a: SelectionTarget, b: SelectionTarget): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'none') return true;
  if (a.type === 'container' && b.type === 'container') return a.containerId === b.containerId;
  if (a.type === 'voxel' && b.type === 'voxel') return a.containerId === b.containerId && a.index === b.index;
  if (a.type === 'face' && b.type === 'face') return a.containerId === b.containerId && a.index === b.index && a.face === b.face;
  if (a.type === 'bay' && b.type === 'bay') {
    return a.containerId === b.containerId && a.bayId === b.bayId &&
      a.indices.length === b.indices.length;
  }
  if (a.type === 'bay-face' && b.type === 'bay-face') {
    return a.containerId === b.containerId && a.bayId === b.bayId &&
      a.indices.length === b.indices.length && a.face === b.face;
  }
  return false;
}

// ── React hook ───────────────────────────────────────────────

export function useSelectionTarget(): SelectionTarget {
  const prevRef = useRef<SelectionTarget>({ type: 'none' });

  const target = useStore((s) => {
    const next = deriveSelectionTarget({
      selectedVoxel: s.selectedVoxel,
      selectedFace: s.selectedFace,
      selectedVoxels: s.selectedVoxels,
      selection: s.selection,
    });
    // Return previous ref if structurally equal → stable reference
    if (selectionTargetEqual(prevRef.current, next)) return prevRef.current;
    prevRef.current = next;
    return next;
  });

  return target;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/selection-target.test.ts`
Expected: 9 tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSelectionTarget.ts src/Testing/selection-target.test.ts
git commit -m "feat: add SelectionTarget derivation with pure function + tests"
```

---

### Task 2: BLOCK_PRESETS Reorder + Tests

**Files:**
- Modify: `src/store/useStore.ts:124-133` (reorder BLOCK_PRESETS, remove duplicate Sealed)
- Modify: any tests that assert preset order or count

- [ ] **Step 1: Check for existing preset tests**

Run: `cd /c/MHome/MContainer && npx vitest run 2>&1 | grep -i "preset\|block_preset\|cycle"` to find any tests that reference BLOCK_PRESETS or cycling.

Also: `grep -r "BLOCK_PRESETS" src/Testing/` to find test files.

- [ ] **Step 2: Reorder BLOCK_PRESETS in useStore.ts**

Replace lines 124-133 of `src/store/useStore.ts`:

```ts
export const BLOCK_PRESETS: BlockPreset[] = [
  // Cycle order: Floor+Ceil → +Rail → +Glass → Deck → Default → Empty
  // Floor-centric first (most common editing = opening up a bay)
  { label: "Floor + Ceiling",  active: true,  faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Open",         s: "Open",         e: "Open",         w: "Open"         } },
  { label: "Floor+Ceil+Rail",  active: true,  faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Railing_Cable",s: "Railing_Cable",e: "Railing_Cable", w: "Railing_Cable" } },
  { label: "Floor+Ceil+Glass", active: true,  faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Glass_Pane",   s: "Glass_Pane",   e: "Glass_Pane",   w: "Glass_Pane"   } },
  { label: "Deck",             active: true,  faces: { top: "Open",        bottom: "Deck_Wood", n: "Open",         s: "Open",         e: "Open",         w: "Open"         } },
  { label: "Default (Steel)",  active: true,  faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Solid_Steel",  s: "Solid_Steel",  e: "Solid_Steel",  w: "Solid_Steel"  } },
  // "Sealed" removed — identical faces to Default (findIndex always matched Default first)
  { label: "Empty",            active: false, faces: { top: "Open",        bottom: "Open",      n: "Open",         s: "Open",         e: "Open",         w: "Open"         } },
];
```

- [ ] **Step 3: Update FIXED_PRESETS in SmartHotbar.tsx if it references BLOCK_PRESETS indices**

Check: `grep -n "BLOCK_PRESETS\|FIXED_PRESETS" src/components/ui/SmartHotbar.tsx` — FIXED_PRESETS (lines 38-98) is a separate array, NOT indexed into BLOCK_PRESETS. No change needed unless tests reference specific preset indices.

- [ ] **Step 4: Run all tests**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass. The cycle action uses `findIndex` by face values (not by array position), so existing voxels will still match their presets.

- [ ] **Step 5: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/useStore.ts
git commit -m "fix: reorder BLOCK_PRESETS — Floor+Ceil first, remove duplicate Sealed"
```

---

### Task 3: Hotbar Auto-Switch Hook

**Files:**
- Create: `src/hooks/useHotbarAutoSwitch.ts`
- Create: `src/Testing/hotbar-auto-switch.test.ts`
- Modify: `src/components/ui/SmartHotbar.tsx` (mount hook, ~line 1260)
- Modify: `src/store/slices/uiSlice.ts:38` (fix comment)

- [ ] **Step 1: Write the failing test**

```ts
// src/Testing/hotbar-auto-switch.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getHotbarTabForTarget, type SelectionTarget } from '../hooks/useHotbarAutoSwitch';

describe('getHotbarTabForTarget', () => {
  it('returns 0 for container target', () => {
    expect(getHotbarTabForTarget({ type: 'container', containerId: 'c1' })).toBe(0);
  });

  it('returns 1 for voxel target', () => {
    expect(getHotbarTabForTarget({ type: 'voxel', containerId: 'c1', index: 5 })).toBe(1);
  });

  it('returns 1 for bay target', () => {
    expect(getHotbarTabForTarget({ type: 'bay', containerId: 'c1', indices: [9, 10], bayId: 'body_0' })).toBe(1);
  });

  it('returns 2 for face target', () => {
    expect(getHotbarTabForTarget({ type: 'face', containerId: 'c1', index: 5, face: 'n' })).toBe(2);
  });

  it('returns 2 for bay-face target', () => {
    expect(getHotbarTabForTarget({ type: 'bay-face', containerId: 'c1', indices: [9, 10], bayId: 'body_0', face: 'e' })).toBe(2);
  });

  it('returns null for none target (no switch)', () => {
    expect(getHotbarTabForTarget({ type: 'none' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/hotbar-auto-switch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/useHotbarAutoSwitch.ts
import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { useSelectionTarget, type SelectionTarget } from './useSelectionTarget';

// ── Pure mapping (exported for testing) ──────────────────────

/** Returns the hotbar tab index for a given selection target type, or null if no switch. */
export function getHotbarTabForTarget(target: SelectionTarget): number | null {
  switch (target.type) {
    case 'container': return 0;        // Rooms
    case 'voxel':                      // Surfaces (configurations)
    case 'bay':       return 1;
    case 'face':                       // Materials
    case 'bay-face':  return 2;
    case 'none':      return null;     // Don't switch on deselection
    default:          return null;
  }
}

export { type SelectionTarget };

// ── React hook ───────────────────────────────────────────────

/**
 * Mount once in SmartHotbar. Watches SelectionTarget.type transitions
 * and auto-switches the hotbar tab. Same-type changes (e.g. clicking
 * a different voxel) do NOT re-trigger.
 */
export function useHotbarAutoSwitch(): void {
  const target = useSelectionTarget();
  const prevType = useRef<SelectionTarget['type']>(target.type);
  const setActiveHotbarTab = useStore((s) => s.setActiveHotbarTab);

  useEffect(() => {
    if (target.type === prevType.current) return; // Same type → skip
    prevType.current = target.type;

    const tab = getHotbarTabForTarget(target);
    if (tab !== null) {
      setActiveHotbarTab(tab);
    }
  }, [target, setActiveHotbarTab]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/hotbar-auto-switch.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Mount hook in SmartHotbar.tsx**

In `src/components/ui/SmartHotbar.tsx`, add the import at the top:
```ts
import { useHotbarAutoSwitch } from '../../hooks/useHotbarAutoSwitch';
```

Inside the main SmartHotbar component function (around line 1260, near the top of the function body), add:
```ts
useHotbarAutoSwitch();
```

- [ ] **Step 6: Fix outdated comment in uiSlice.ts**

In `src/store/slices/uiSlice.ts`, line 38, change:
```ts
// Hotbar tab (0 = rooms, 1 = materials, 2 = furniture)
```
to:
```ts
// Hotbar tab: 0=Rooms, 1=Surfaces, 2=Materials, 3=Furniture (see SmartHotbar.tsx lines 1475-1478)
```

- [ ] **Step 7: Run all tests + TypeScript check**

Run: `cd /c/MHome/MContainer && npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useHotbarAutoSwitch.ts src/Testing/hotbar-auto-switch.test.ts src/components/ui/SmartHotbar.tsx src/store/slices/uiSlice.ts
git commit -m "feat: add hotbar auto-switch on selection type transitions"
```

---

### Task 4: Materials Tab Face-Category Filtering

**Files:**
- Modify: `src/components/ui/SmartHotbar.tsx:102-123,1656-1783` (add filter function, apply to materials bar)

- [ ] **Step 1: Write the filtering function test**

Add to `src/Testing/hotbar-auto-switch.test.ts`:

```ts
import { getVisibleSwatches } from '../hooks/useHotbarAutoSwitch';

describe('getVisibleSwatches', () => {
  it('returns all swatches when no face selected', () => {
    const result = getVisibleSwatches(null);
    expect(result.length).toBeGreaterThan(0);
    // Should include both wall and floor items
    expect(result.some(s => s.group === 'wall')).toBe(true);
    expect(result.some(s => s.group === 'floor')).toBe(true);
  });

  it('returns wall + window + special (minus stairs) for wall face', () => {
    const result = getVisibleSwatches('n');
    expect(result.every(s => s.group !== 'floor')).toBe(true);
    expect(result.some(s => s.group === 'wall')).toBe(true);
    expect(result.some(s => s.group === 'window')).toBe(true);
    // Stairs should be excluded from wall faces
    expect(result.every(s => s.surface !== 'Stairs' && s.surface !== 'Stairs_Down')).toBe(true);
  });

  it('returns floor + Open for floor face (bottom)', () => {
    const result = getVisibleSwatches('bottom');
    expect(result.some(s => s.group === 'floor')).toBe(true);
    expect(result.some(s => s.surface === 'Open')).toBe(true);
    expect(result.every(s => s.group === 'floor' || s.surface === 'Open')).toBe(true);
  });

  it('returns only Steel + Open for ceiling face (top)', () => {
    const result = getVisibleSwatches('top');
    expect(result.every(s => s.surface === 'Solid_Steel' || s.surface === 'Open')).toBe(true);
    expect(result.length).toBe(2);
  });
});
```

- [ ] **Step 2: Move MATERIAL_SWATCHES to the hook file and add getVisibleSwatches**

Move the `MATERIAL_SWATCHES` array from SmartHotbar.tsx (lines 102-123) to `src/hooks/useHotbarAutoSwitch.ts` (or a shared config file) so it can be imported by both the test and SmartHotbar. Export it.

Add the filter function:

```ts
import type { SurfaceType } from '../types/container';

export interface MaterialSwatch {
  surface: SurfaceType;
  label: string;
  group: 'wall' | 'floor' | 'window' | 'special';
}

export const MATERIAL_SWATCHES: MaterialSwatch[] = [
  // ... (copy existing array from SmartHotbar.tsx lines 102-123)
];

export function getVisibleSwatches(face: string | null): MaterialSwatch[] {
  if (!face) return MATERIAL_SWATCHES;

  if (face === 'top') {
    // Ceiling: only Steel and Open
    return MATERIAL_SWATCHES.filter(s => s.surface === 'Solid_Steel' || s.surface === 'Open');
  }

  if (face === 'bottom') {
    // Floor: floor group + Open
    return MATERIAL_SWATCHES.filter(s => s.group === 'floor' || s.surface === 'Open');
  }

  // Wall face (n/s/e/w): wall + window + special (minus stairs)
  return MATERIAL_SWATCHES.filter(s =>
    (s.group === 'wall' || s.group === 'window' || s.group === 'special') &&
    s.surface !== 'Stairs' && s.surface !== 'Stairs_Down'
  );
}
```

- [ ] **Step 3: Update SmartHotbar.tsx to import and use the filter**

In `src/components/ui/SmartHotbar.tsx`:

1. Remove the local `MATERIAL_SWATCHES` array (lines 102-123)
2. Add import: `import { MATERIAL_SWATCHES, getVisibleSwatches } from '../../hooks/useHotbarAutoSwitch';`
3. In the materials bar rendering (around line 1688), replace references to `MATERIAL_SWATCHES` with `getVisibleSwatches(selectedFace)`:

```tsx
const selectedFace = useStore((s) => s.selectedFace);
const visibleSwatches = getVisibleSwatches(selectedFace);
// Use visibleSwatches instead of MATERIAL_SWATCHES for pagination + rendering
```

**Important:** Three things need updating when using `visibleSwatches`:
1. Reset `materialsPage` to 0 when `selectedFace` changes: add `useEffect(() => setMaterialPage(0), [selectedFace])`
2. Update `materialPageCount` calculation (around line 1267) to use `visibleSwatches.length` instead of `MATERIAL_SWATCHES.length`
3. Update keyboard shortcut handler (around line 1373, `matIndex < MATERIAL_SWATCHES.length`) to use `visibleSwatches.length`

- [ ] **Step 4: Run all tests**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useHotbarAutoSwitch.ts src/Testing/hotbar-auto-switch.test.ts src/components/ui/SmartHotbar.tsx
git commit -m "feat: filter Materials tab by selected face category"
```

---

### Task 5: Wall Selection Highlight (3D)

**Files:**
- Modify: `src/components/three/ContainerMesh.tsx:1927-1930,1959-2141` (add cyan face overlay for selection)

This task adds a persistent cyan face overlay when a wall face is selected, replacing the whole-voxel wireframe when a face is active.

- [ ] **Step 1: Add selection wall material**

In `src/components/three/ContainerMesh.tsx`, near the existing `hlWallMat` definition (line 1927), add:

```ts
// §7.2 Selection wall face overlay (cyan)
const hlWallSelectMat = new THREE.MeshBasicMaterial({
  color: 0x00bcd4, transparent: true, opacity: 0.3,
  depthWrite: false, depthTest: false, side: THREE.DoubleSide,
});
```

- [ ] **Step 2: Modify VoxelHoverHighlight to render face overlay on selection**

In the `VoxelHoverHighlight` component (lines 1959-2141), find where the cyan selection wireframe is rendered (around line 2079-2087). Add logic:

When `selectedFace` is set AND `isSelect` is true for this voxel:
- **Don't render** the whole-voxel wireframe
- **Instead render** a cyan face overlay mesh (same geometry approach as the hover wall overlay at lines 2098-2108, but using `hlWallSelectMat` instead of `hlWallMat`)

The face overlay geometry and positioning should match the existing hover overlay code. For wall faces (n/s/e/w), position at the wall center with appropriate Y-rotation. For floor (bottom) and ceiling (top), position at the horizontal face.

**Mutual exclusion logic:**
```ts
const showVoxelWireframe = isSelect && !selectedFace;
const showFaceOverlay = isSelect && selectedFace;
```

- [ ] **Step 3: Handle bay-face selection (Simple mode merged overlay)**

When `selectedVoxels` is set with a `selectedFace`, render a single merged face overlay spanning all active voxels in the bay group on that face side. Use the same AABB merge logic already used for bay group wireframes (lines 2037-2055), but extract just the face dimension for the overlay quad.

- [ ] **Step 4: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Run all tests**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/three/ContainerMesh.tsx
git commit -m "feat: add persistent cyan face overlay for wall selection"
```

---

### Task 6: Wall Selection Highlight (2D BlockGrid)

**Files:**
- Modify: `src/components/ui/MatrixEditor.tsx:119-143` (GridCell border styling)

- [ ] **Step 1: Update GridCell border styling**

In `src/components/ui/MatrixEditor.tsx`, the `borderStyle` conditional (lines 119-143) already handles `isSelected && syncFace` with cyan borders. Verify that `syncFace` is being passed correctly when a face is selected.

The existing logic at lines 119-125:
```ts
isSelected && syncFace
  ? {
      borderTop:    syncFace === "n" ? "3px solid #06b6d4" : "2px solid #2563eb",
      borderBottom: syncFace === "s" ? "3px solid #06b6d4" : "2px solid #2563eb",
      borderRight:  syncFace === "e" ? "3px solid #06b6d4" : "2px solid #2563eb",
      borderLeft:   syncFace === "w" ? "3px solid #06b6d4" : "2px solid #2563eb",
    }
```

This already renders the correct cyan border on the selected face. Verify that `syncFace` is wired to `selectedFace` from the store. If it's only wired for hover, add the selection path.

Check: `grep -n "syncFace" src/components/ui/MatrixEditor.tsx` to see where it's passed to GridCell.

- [ ] **Step 2: Ensure syncFace is set from selectedFace (not just hover)**

If `syncFace` only comes from hover state, add a fallback:

```ts
const syncFace = hoveredEdgeFace ?? (isSelected ? selectedFace : null);
```

This means: when hovering, show hover edge; when selected (no hover), show selected edge.

- [ ] **Step 3: Run TypeScript check + tests**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/MatrixEditor.tsx
git commit -m "feat: persist cyan edge indicator for selected face in 2D grid"
```

---

### Task 7: Fix `checkUnsupportedCantilever` False Positive

**Files:**
- Modify: `src/utils/designValidation.ts:229-250`
- Modify: tests that assert cantilever warnings

- [ ] **Step 1: Write the failing test**

Add to existing validation test file (find via `grep -rn "cantilever\|unsupported" src/Testing/`):

```ts
it('does not flag supported extension voxel (has active body neighbor)', () => {
  // Create a container with active body voxels and an adjacent active extension
  // Row 0 is north extension row. Voxel at (row=0, col=3) is extension.
  // Its inward neighbor at (row=1, col=3) is body. If body is active → no warning.
  const container = createTestContainer();
  // Set body voxel at index row=1,col=3 (index=11) as active with steel top
  container.voxelGrid[11].active = true;
  container.voxelGrid[11].faces.top = 'Solid_Steel';
  // Set extension voxel at index row=0,col=3 (index=3) as active with steel top
  container.voxelGrid[3].active = true;
  container.voxelGrid[3].faces.top = 'Solid_Steel';

  const warnings = checkUnsupportedCantilever({ test: container });
  // Extension voxel 3 is supported by body voxel 11 → should NOT be flagged
  expect(warnings.find(w => w.voxelIndices.includes(3))).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run the relevant test file.
Expected: FAIL — the current implementation flags ALL extension voxels with roofing.

- [ ] **Step 3: Fix the validation rule**

In `src/utils/designValidation.ts`, replace the `checkUnsupportedCantilever` function (lines 229-250):

```ts
/** Find extension voxels with roofing but no structural support.
 *  An extension is supported if any inward-facing neighbor (toward body zone) is active. */
export const checkUnsupportedCantilever: ValidationRule = (containers) => {
  const warnings: DesignWarning[] = [];
  for (const c of Object.values(containers)) {
    if (!c.voxelGrid) continue;
    for (let i = 0; i < c.voxelGrid.length; i++) {
      const v = c.voxelGrid[i];
      if (!v.active) continue;
      const { row, col } = decodeIndex(i);
      const isExtension = row === 0 || row === VOXEL_ROWS - 1 || col === 0 || col === VOXEL_COLS - 1;
      if (!isExtension || v.faces.top === 'Open') continue;

      // Check if any inward neighbor is active (provides structural support)
      // decodeIndex returns {level, row, col}; we need to stay on the same level
      const { level } = decodeIndex(i);
      const perLevel = VOXEL_ROWS * VOXEL_COLS;
      const encode = (r: number, c: number) => level * perLevel + r * VOXEL_COLS + c;

      const inwardNeighbors: number[] = [];
      if (row === 0) inwardNeighbors.push(encode(row + 1, col));          // south neighbor
      if (row === VOXEL_ROWS - 1) inwardNeighbors.push(encode(row - 1, col)); // north neighbor
      if (col === 0) inwardNeighbors.push(encode(row, col + 1));          // east neighbor
      if (col === VOXEL_COLS - 1) inwardNeighbors.push(encode(row, col - 1)); // west neighbor

      const hasSupport = inwardNeighbors.some(ni => {
        const nv = c.voxelGrid![ni];
        return nv && nv.active;
      });

      if (!hasSupport) {
        warnings.push({
          id: `structural-cantilever-${c.id}-${i}`,
          category: 'structural',
          severity: 'info',
          message: `Extension voxel ${i} has roofing without structural support`,
          containerId: c.id,
          voxelIndices: [i],
        });
      }
    }
  }
  return warnings;
};
```

The `encode` helper is defined inline with level awareness. No `encodeIndex` exists in the codebase — this is intentional.

- [ ] **Step 4: Run test to verify it passes**

Expected: The new test passes — supported extension voxels are no longer flagged.

- [ ] **Step 5: Run all tests**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/designValidation.ts src/Testing/*.test.ts
git commit -m "fix: checkUnsupportedCantilever no longer flags supported extensions"
```

---

### Task 8: Warning Badge + Popover (UI Refactor)

**Files:**
- Create: `src/components/ui/WarningBadge.tsx`
- Create: `src/components/ui/WarningPopover.tsx` (refactored from WarningPanel.tsx)
- Delete: `src/components/ui/WarningPanel.tsx`
- Modify: `src/components/ui/TopToolbar.tsx` (mount WarningBadge)
- Modify: `src/components/ui/Sidebar.tsx:39,880` (remove WarningPanel import + usage)

- [ ] **Step 1: Create WarningBadge component**

```tsx
// src/components/ui/WarningBadge.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import { AlertTriangle } from "lucide-react";
import WarningPopover from "./WarningPopover";

export default function WarningBadge() {
  const warnings = useStore(useShallow((s) => s.warnings));
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close popover on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (warnings.length === 0) return null;

  const maxSeverity = warnings.some(w => w.severity === 'error') ? 'error'
    : warnings.some(w => w.severity === 'warning') ? 'warning' : 'info';
  const badgeColor = maxSeverity === 'error' ? '#ef4444'
    : maxSeverity === 'warning' ? '#f59e0b' : '#3b82f6';

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 8px", borderRadius: 6, border: "none",
          background: open ? "#1e293b" : "transparent",
          color: badgeColor, cursor: "pointer", fontSize: 11, fontWeight: 700,
        }}
        title="Design warnings"
      >
        <AlertTriangle size={14} />
        {warnings.length}
      </button>
      {open && <WarningPopover onClose={() => setOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Refactor WarningPanel into WarningPopover**

Rename `src/components/ui/WarningPanel.tsx` to `src/components/ui/WarningPopover.tsx`. Update the component:

- Add `onClose` prop
- Add absolute positioning (popover below toolbar):
```tsx
<div style={{
  position: "absolute", top: "100%", right: 0, marginTop: 8,
  width: 320, maxHeight: 400, overflowY: "auto",
  background: "#0f172a", border: "1px solid #334155",
  borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  zIndex: 100,
}}>
```
- Keep existing warning grouping, hover, and click logic
- Add click-outside handler to close

- [ ] **Step 3: Add warning click → solution mapping**

In the click handler (currently lines 73-76 of WarningPanel), add solution mapping after `setSelectedVoxel`:

```ts
onClick={() => {
  const idx = w.voxelIndices[0] ?? 0;
  setSelectedVoxel({ containerId: w.containerId, index: idx });
  // Guide hotbar to solution based on warning rule
  if (w.message.includes('all walls are solid') || w.message.includes('No exit')) {
    // Find first solid wall face on the voxel
    const voxel = useStore.getState().containers[w.containerId]?.voxelGrid?.[idx];
    const solidWall = (['n','s','e','w'] as const).find(f => voxel?.faces[f] === 'Solid_Steel');
    if (solidWall) setSelectedFace(solidWall);
    // Auto-switch to Materials will happen via useHotbarAutoSwitch
  } else if (w.message.includes('without structural support') || w.message.includes('Stair to nowhere')) {
    setSelectedFace(null); // Voxel-level → auto-switch to Surfaces
  } else if (w.message.includes('Unprotected edge') || w.message.includes('weather')) {
    const voxel = useStore.getState().containers[w.containerId]?.voxelGrid?.[idx];
    const openWall = (['n','s','e','w'] as const).find(f => voxel?.faces[f] === 'Open');
    if (openWall) setSelectedFace(openWall);
  }
  onClose();
}
```

- [ ] **Step 4: Mount WarningBadge in TopToolbar**

In `src/components/ui/TopToolbar.tsx`, add:
```tsx
import WarningBadge from './WarningBadge';
```

Mount `<WarningBadge />` in the toolbar, after the Sun slider area (so it appears near the right side of the toolbar).

- [ ] **Step 5: Remove WarningPanel from Sidebar**

In `src/components/ui/Sidebar.tsx`:
1. Remove the import on line 39: `import WarningPanel from "@/components/ui/WarningPanel";`
2. Remove the usage on line 880: `<WarningPanel />`

The warnings now live in the toolbar badge/popover.

- [ ] **Step 6: Run TypeScript check + tests**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git rm src/components/ui/WarningPanel.tsx
git add src/components/ui/WarningBadge.tsx src/components/ui/WarningPopover.tsx src/components/ui/TopToolbar.tsx src/components/ui/Sidebar.tsx
git commit -m "feat: move warnings to compact toolbar badge with popover + solution mapping"
```

---

### Task 9: Integration Verification

**Files:**
- No new files — verification only.

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run full test suite**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Browser verification — selection context auto-switch**

Start dev server. Test:
1. Click a voxel → hotbar switches to Surfaces tab
2. Click a wall edge → hotbar switches to Materials tab
3. Click a different voxel (no wall) → hotbar switches back to Surfaces
4. Click same voxel again → tab stays (no flicker)
5. Press Escape → hotbar stays on current tab (no switch)

- [ ] **Step 4: Browser verification — wall selection highlight**

1. Click a wall edge → cyan face overlay appears on the 3D wall
2. Move mouse away → cyan overlay persists (not lost like hover)
3. Click a different wall → overlay moves to new wall
4. Click voxel center (not wall) → wireframe appears instead of face overlay
5. In Simple mode, click a bay wall → merged overlay spans full bay edge

- [ ] **Step 5: Browser verification — preset cycle**

1. Double-click a Default voxel → should cycle to Floor+Ceil (open walls, floor+ceiling)
2. Double-click again → Floor+Ceil+Rail (adds railing)
3. Continue cycling → Glass → Deck → Default → Empty

- [ ] **Step 6: Browser verification — warning badge**

1. With a default container, verify warning badge shows in toolbar (not inline in inspector)
2. Click badge → popover opens with grouped warnings
3. Click "No exit" warning → selects a solid wall + Materials tab shows doors
4. Hover a cantilever warning → 3D overlay highlights the extension voxel
5. Verify extension voxels adjacent to active body voxels are NOT flagged

- [ ] **Step 7: Browser verification — materials face filtering**

1. Select a wall face → Materials tab shows wall materials (Steel, Glass, Door, etc.)
2. Select a floor face → Materials tab shows floor materials (Wood, Concrete, Open)
3. Select a ceiling face → Materials tab shows only Steel and Open
4. Deselect (Escape) then manually switch to Materials → all swatches shown (unfiltered)

- [ ] **Step 8: Run acceptance gates**

Run: `cd /c/MHome/MContainer && npm run gates`
Expected: All gates pass.

---

## Summary of Tasks

| Task | Description | Est. Files | Dependencies |
|------|-------------|-----------|--------------|
| 1 | SelectionTarget derivation + tests | 2 new | None |
| 2 | BLOCK_PRESETS reorder | 1 modify | None |
| 3 | Hotbar auto-switch hook | 3 new, 2 modify | Task 1 |
| 4 | Materials face-category filtering | 2 modify | Task 3 |
| 5 | Wall selection highlight (3D) | 1 modify | Task 1 |
| 6 | Wall selection highlight (2D) | 1 modify | None |
| 7 | Fix cantilever false positive | 1 modify, 1 test | None |
| 8 | Warning badge + popover + solution mapping | 2 new, 2 modify | Tasks 1, 3 |
| 9 | Integration verification | 0 | All |

**Independent tasks (can run in parallel):** Tasks 1, 2, 6, 7 have no dependencies.
**Sequential:** Task 3 depends on 1. Task 4 depends on 3. Tasks 5 and 8 depend on 1+3.

**Total new files:** 4 (`useSelectionTarget.ts`, `selection-target.test.ts`, `useHotbarAutoSwitch.ts`, `WarningBadge.tsx`)
**Total modified files:** 7 (`useStore.ts`, `SmartHotbar.tsx`, `ContainerMesh.tsx`, `MatrixEditor.tsx`, `designValidation.ts`, `WarningPanel.tsx→WarningPopover.tsx`, `TopToolbar.tsx`)
