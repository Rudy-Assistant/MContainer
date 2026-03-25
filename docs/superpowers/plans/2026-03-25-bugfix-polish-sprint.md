# Bugfix & Polish Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 bugs (grid orientation, container presets, context-aware tabs, hotbar text, wireframe debug) and add ghost preview for stamp mode.

**Architecture:** Six independent tasks, each committed separately for rollback. Tasks 3 and 5 both touch ContainerSkin.tsx — do 3 first. Task 4 is split into 4a (CSS styling) and 4b (ghost preview state + 3D rendering).

**Tech Stack:** Next.js 16, React 19, Three.js, Zustand 5 (7 slices), Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-25-bugfix-polish-sprint-design.md`

---

## File Map

| Task | Create | Modify | Test |
|------|--------|--------|------|
| 1. Grid Orientation | — | `src/config/bayGroups.ts`, `src/components/ui/finishes/SpatialVoxelGrid.tsx`, `src/components/ui/MatrixEditor.tsx` | `src/__tests__/bay-groups.test.ts` |
| 2. Preset Cards | `src/components/ui/finishes/ContainerPresetCard.tsx` | `src/components/ui/finishes/ContainerPresetRow.tsx` | `src/__tests__/container-tab-presets.test.ts` |
| 3. Context-Aware Tabs | — | `src/store/slices/selectionSlice.ts`, `src/components/ui/finishes/FinishesPanel.tsx`, `src/components/objects/ContainerSkin.tsx` | `src/__tests__/selection-elements.test.ts`, `src/__tests__/finishes-panel.test.ts` |
| 4a. Hotbar Styling | — | `src/components/ui/BottomPanel.tsx`, `src/components/ui/SmartHotbar.tsx` | — (visual, Playwright verify) |
| 4b. Ghost Preview | — | `src/store/slices/uiSlice.ts`, `src/components/objects/HoverPreviewGhost.tsx` | `src/__tests__/ghost-preview.test.ts` |
| 5. Wireframe Debug | — | `src/components/three/DebugOverlay.tsx`, `src/components/objects/ContainerSkin.tsx` | — (visual, Playwright verify) |

---

## Task 1: Grid Orientation Fix

**Files:**
- Modify: `src/config/bayGroups.ts:69-91` (deck label loop)
- Modify: `src/components/ui/finishes/SpatialVoxelGrid.tsx:17-39` (GRID_ROWS labels)
- Modify: `src/components/ui/finishes/SpatialVoxelGrid.tsx:129-195` (grid JSX — add FRONT/BACK)
- Modify: `src/components/ui/MatrixEditor.tsx` (SimpleBayGrid — add FRONT/BACK labels)
- Test: `src/__tests__/bay-groups.test.ts`

- [ ] **Step 1: Write failing test for reversed deck numbering**

Add to `src/__tests__/bay-groups.test.ts`:

```typescript
it('S Deck 3 maps to nearest cols (1-2), S Deck 1 maps to farthest cols (5-6)', () => {
  const groups = computeBayGroups();
  const sDeck3 = groups.find(g => g.label === 'S Deck 3');
  const sDeck1 = groups.find(g => g.label === 'S Deck 1');
  expect(sDeck3).toBeDefined();
  expect(sDeck1).toBeDefined();
  // idx(3, 1)=25, idx(3, 2)=26 → nearest (cols 1-2)
  expect(sDeck3!.voxelIndices).toEqual([25, 26]);
  // idx(3, 5)=29, idx(3, 6)=30 → farthest (cols 5-6)
  expect(sDeck1!.voxelIndices).toEqual([29, 30]);
});

it('N Deck 3 maps to nearest cols (1-2), N Deck 1 maps to farthest cols (5-6)', () => {
  const groups = computeBayGroups();
  const nDeck3 = groups.find(g => g.label === 'N Deck 3');
  const nDeck1 = groups.find(g => g.label === 'N Deck 1');
  expect(nDeck3).toBeDefined();
  expect(nDeck1).toBeDefined();
  // idx(0, 1)=1, idx(0, 2)=2 → nearest (cols 1-2)
  expect(nDeck3!.voxelIndices).toEqual([1, 2]);
  // idx(0, 5)=5, idx(0, 6)=6 → farthest (cols 5-6)
  expect(nDeck1!.voxelIndices).toEqual([5, 6]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/bay-groups.test.ts`
Expected: FAIL — currently Deck 1 maps to cols 1-2 and Deck 3 maps to cols 5-6

- [ ] **Step 3: Reverse deck label numbering in bayGroups.ts**

In `src/config/bayGroups.ts`, replace lines 69-91 (the extension side loop):

```typescript
  // 6 extension side pairs (row 0 cols 1-6, row 3 cols 1-6 — 2 cols per group)
  // Numbering: Deck 3 = nearest camera (cols 1-2), Deck 1 = farthest (cols 5-6)
  for (let i = 0; i < 3; i++) {
    const c1 = 1 + i * 2;
    const c2 = c1 + 1;
    const deckNum = 3 - i; // 3, 2, 1 (nearest to farthest)
    groups.push({
      id: `ext_n_${i}`,
      label: `N Deck ${deckNum}`,
      role: 'extension_side',
      voxelIndices: [idx(0, c1), idx(0, c2)],
      gridRow: 1,
      gridCol: c1 + 1,
      rowSpan: 1,
      colSpan: 2,
    });
    groups.push({
      id: `ext_s_${i}`,
      label: `S Deck ${deckNum}`,
      role: 'extension_side',
      voxelIndices: [idx(3, c1), idx(3, c2)],
      gridRow: 4,
      gridCol: c1 + 1,
      rowSpan: 1,
      colSpan: 2,
    });
  }
```

Key change: `i + 1` → `3 - i` for `deckNum`.

Note: The `_reverseMap` cache in `getBayGroupForVoxel` is lazily built from `computeBayGroups()`. Since we're changing the label assignments inside `computeBayGroups()` itself, the cache will be built correctly on first use after the code change. No cache invalidation needed.

- [ ] **Step 4: Update GRID_ROWS in SpatialVoxelGrid.tsx**

In `src/components/ui/finishes/SpatialVoxelGrid.tsx`, replace lines 14-39:

```typescript
// Indices from computeBayGroups() in bayGroups.ts. idx(row,col) = row*8+col.
// Column order matches MatrixEditor: col 0 (+X, nearest camera) on LEFT.
// Numbering: Deck 3 = nearest to default camera, Deck 1 = farthest.
const GRID_ROWS: CellDef[][] = [
  [
    { label: 'NW Corner', indices: [0],       ext: true },
    { label: 'N Deck 3',  indices: [1, 2],    ext: true },
    { label: 'N Deck 2',  indices: [3, 4],    ext: false },
    { label: 'N Deck 1',  indices: [5, 6],    ext: false },
    { label: 'NE Corner', indices: [7],       ext: true },
  ],
  [
    { label: 'W End',  indices: [8, 16],                     ext: false },
    { label: 'Bay 1',  indices: [9, 10, 17, 18],             ext: false },
    { label: 'Bay 2',  indices: [11, 12, 19, 20],            ext: false },
    { label: 'Bay 3',  indices: [13, 14, 21, 22],            ext: false },
    { label: 'E End',  indices: [15, 23],                    ext: false },
  ],
  [
    { label: 'SW Corner', indices: [24],      ext: true },
    { label: 'S Deck 3',  indices: [25, 26],  ext: true },
    { label: 'S Deck 2',  indices: [27, 28],  ext: false },
    { label: 'S Deck 1',  indices: [29, 30],  ext: false },
    { label: 'SE Corner', indices: [31],      ext: true },
  ],
];
```

- [ ] **Step 5: Add FRONT/BACK directional labels to SpatialVoxelGrid**

In `src/components/ui/finishes/SpatialVoxelGrid.tsx`, wrap the grid return in a parent div. Replace the return block (lines 129-196):

```tsx
  return (
    <div>
      {/* FRONT label */}
      <div style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
        color: 'var(--text-dim)', textAlign: 'center',
        marginBottom: 2, textTransform: 'uppercase',
      }}>
        FRONT
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '0.7fr 1.4fr 1.4fr 1.4fr 0.7fr',
        gridTemplateRows: '0.6fr 1.4fr 0.6fr',
        gap: 3,
      }}>
        {ALL_CELLS.map((cell) => {
          // ... existing cell rendering unchanged ...
        })}
      </div>
      {/* BACK label */}
      <div style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
        color: 'var(--text-dim)', textAlign: 'center',
        marginTop: 2, textTransform: 'uppercase',
      }}>
        BACK
      </div>
    </div>
  );
```

- [ ] **Step 6: Add FRONT/BACK labels to MatrixEditor SimpleBayGrid**

Search `src/components/ui/MatrixEditor.tsx` for the SimpleBayGrid component's grid rendering. Add matching `FRONT` and `BACK` labels above and below the grid using the same styling as SpatialVoxelGrid (fontSize 9, fontWeight 600, color `var(--text-dim)`, uppercase).

Also update any hardcoded "S Deck 1/2/3" or "N Deck 1/2/3" labels in the MatrixEditor to match the reversed numbering (Deck 3 = nearest, Deck 1 = farthest). Search for these strings and swap them.

- [ ] **Step 7: Run tests**

Run: `npx vitest run src/__tests__/bay-groups.test.ts`
Expected: All tests PASS including the new reversed-numbering tests

- [ ] **Step 8: Run full test suite + type check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 9: Playwright verification**

Start dev server, load a container, click the nearest extension voxel in the 3D view. Confirm:
1. MatrixEditor highlights "S Deck 3" (not "S Deck 1")
2. SpatialVoxelGrid shows "FRONT" at top, "BACK" at bottom
3. Grid label shows "S Deck 3" for the cell nearest to camera

- [ ] **Step 10: Commit**

```bash
git add src/config/bayGroups.ts src/components/ui/finishes/SpatialVoxelGrid.tsx src/components/ui/MatrixEditor.tsx src/__tests__/bay-groups.test.ts
git commit -m "fix: reverse deck numbering so Deck 3 = nearest camera, add FRONT/BACK labels"
```

---

## Task 2: Container Preset Icon Cards

**Files:**
- Create: `src/components/ui/finishes/ContainerPresetCard.tsx`
- Modify: `src/components/ui/finishes/ContainerPresetRow.tsx`
- Test: `src/__tests__/container-tab-presets.test.ts`

- [ ] **Step 1: Create ContainerPresetCard wrapper component**

Create `src/components/ui/finishes/ContainerPresetCard.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { PresetCard } from './PresetCard';

interface ContainerPresetCardProps {
  content: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * Larger container-level preset card.
 * Wraps PresetCard with dark background, subtle border, increased image area.
 */
export function ContainerPresetCard({
  content, label, active, onClick, onMouseEnter, onMouseLeave,
}: ContainerPresetCardProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid rgba(255,255,255,0.08)`,
      borderRadius: 8,
      padding: 6,
    }}>
      <PresetCard
        content={content}
        label={label}
        active={active}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update ContainerPresetRow to use 3-column grid + ContainerPresetCard**

Replace `src/components/ui/finishes/ContainerPresetRow.tsx` entirely:

```tsx
'use client';

import { useStore } from '@/store/useStore';
import { ContainerPresetCard } from './ContainerPresetCard';
import { IsometricVoxelSVG } from '../svg/IsometricVoxelSVG';
import { CONTAINER_LEVEL_PRESETS } from '@/config/containerTabPresets';

interface Props {
  containerId: string;
  onApply: (presetId: string) => void;
}

export function ContainerPresetRow({ containerId: _containerId, onApply }: Props) {
  const setGhostPreset = useStore((s) => s.setGhostPreset);
  const clearGhostPreset = useStore((s) => s.clearGhostPreset);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, minWidth: 0 }}>
      {CONTAINER_LEVEL_PRESETS.map(p => (
        <ContainerPresetCard
          key={p.id}
          content={<IsometricVoxelSVG faces={p.faces} size={48} />}
          label={p.label}
          active={false}
          onClick={() => onApply(p.id)}
          onMouseEnter={() => setGhostPreset({ source: 'container', faces: p.faces, targetScope: 'container' })}
          onMouseLeave={() => clearGhostPreset()}
        />
      ))}
    </div>
  );
}
```

Key changes: `repeat(5, 1fr)` → `repeat(3, 1fr)`, `gap: 4` → `gap: 6`, SVG `size={36}` → `size={48}`, `PresetCard` → `ContainerPresetCard`.

- [ ] **Step 3: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run src/__tests__/container-tab-presets.test.ts`
Expected: 0 type errors, tests pass

- [ ] **Step 4: Playwright verification**

Start dev server, select a container, open Inspector > Container tab. Confirm:
1. Presets appear in a 3-column grid (3 top row, 2 bottom row)
2. Cards are visibly larger than before with dark background and border
3. Labels are readable, highlight works on image area only
4. Hover triggers ghost preview in 3D

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/finishes/ContainerPresetCard.tsx src/components/ui/finishes/ContainerPresetRow.tsx
git commit -m "feat: container presets as larger icon cards in 3-column grid"
```

---

## Task 3: Context-Aware Tab Switching

**Files:**
- Modify: `src/store/slices/selectionSlice.ts:221-225` (add `selectWithFace` action)
- Modify: `src/components/ui/finishes/FinishesPanel.tsx:29-35` (unified tab routing effect)
- Modify: `src/components/objects/ContainerSkin.tsx` (replace dual calls with `selectWithFace`)
- Test: `src/__tests__/selection-elements.test.ts`

- [ ] **Step 1: Write failing test for selectWithFace**

Add to `src/__tests__/selection-elements.test.ts`:

```typescript
describe('selectWithFace — batched selection + face', () => {
  beforeEach(resetStore);

  it('sets both selectedElements and selectedFace in one call', () => {
    const sel = { type: 'voxel' as const, items: [{ containerId: 'c1', id: '10' }] };
    useStore.getState().selectWithFace(sel, 'n');
    const state = useStore.getState();
    expect(state.selectedElements).toEqual(sel);
    expect(state.selectedFace).toBe('n');
  });

  it('clears both when sel is null', () => {
    useStore.getState().selectWithFace(
      { type: 'voxel' as const, items: [{ containerId: 'c1', id: '10' }] }, 'w'
    );
    useStore.getState().selectWithFace(null, null);
    expect(useStore.getState().selectedElements).toBeNull();
    expect(useStore.getState().selectedFace).toBeNull();
  });

  it('preserves existing selectedFace when face arg is null but sel is non-null', () => {
    useStore.getState().setSelectedFace('e');
    const sel = { type: 'voxel' as const, items: [{ containerId: 'c1', id: '10' }] };
    useStore.getState().selectWithFace(sel, null);
    expect(useStore.getState().selectedElements).toEqual(sel);
    expect(useStore.getState().selectedFace).toBe('e'); // preserved
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/selection-elements.test.ts`
Expected: FAIL — `selectWithFace` does not exist yet

- [ ] **Step 3: Add selectWithFace action to selectionSlice.ts**

In `src/store/slices/selectionSlice.ts`, add to the type definition (near line 77):

```typescript
selectWithFace: (
  sel: { type: ElementType; items: Array<{ containerId: string; id: string }> } | null,
  face: keyof VoxelFaces | null
) => void;
```

Add the implementation after `setSelectedElements` (after line 225):

```typescript
selectWithFace: (sel, face) => set({
  selectedElements: sel,
  ...(sel === null ? { selectedFace: null } : face !== null ? { selectedFace: face } : {}),
}),
```

Logic: If clearing selection (`sel === null`), clear face too. If face is explicitly provided, set it. If face is null but sel is non-null, leave existing face untouched.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/selection-elements.test.ts`
Expected: All tests PASS

- [ ] **Step 5a: Replace dual calls in ContainerSkin.tsx — body voxel click (~line 2362-2369)**

This location has a conditional branch (bay mode vs. single voxel). Both branches need `selectWithFace`. **Always use `useStore.getState().selectWithFace(...)` — not local selector variables**, because `selectWithFace` is a new action that must be called via getState().

```typescript
// BEFORE (~line 2362-2369):
if (bayIndices) {
  useStore.getState().setSelectedElements({ type: 'bay', items: bayIndices.map(i => ({ containerId: container.id, id: String(i) })) });
} else {
  setSelectedElements({ type: 'voxel', items: [{ containerId: container.id, id: String(voxelIndex) }] });
}
useStore.getState().setSelectedFace(faceName);

// AFTER:
if (bayIndices) {
  useStore.getState().selectWithFace({ type: 'bay', items: bayIndices.map(i => ({ containerId: container.id, id: String(i) })) }, faceName);
} else {
  useStore.getState().selectWithFace({ type: 'voxel', items: [{ containerId: container.id, id: String(voxelIndex) }] }, faceName);
}
```

- [ ] **Step 5b: Replace dual calls — baseplate floor click (~line 2965-2970)**

Same pattern: conditional bay vs. single voxel, then `setSelectedFace('bottom')`.

```typescript
// AFTER:
if (bayIndices) {
  useStore.getState().selectWithFace({ type: 'bay', items: bayIndices.map(...) }, 'bottom');
} else {
  useStore.getState().selectWithFace({ type: 'voxel', items: [{ containerId: container.id, id: String(idx) }] }, 'bottom');
}
```

- [ ] **Step 5c: Replace dual calls — wall face click (~line 3024-3037)**

Same conditional pattern. Replace both the bay branch and the voxel branch + `setSelectedFace(face)`:

```typescript
// AFTER:
if (bayIndices) {
  useStore.getState().selectWithFace({ type: 'bay', items: bayIndices.map(...) }, face);
} else {
  useStore.getState().selectWithFace({ type: 'voxel', items: [{ containerId: container.id, id: String(idx) }] }, face);
}
```

Keep `setSelectedElements` calls that do NOT have an accompanying `setSelectedFace` unchanged (e.g., extension context menu selections).

- [ ] **Step 6: Update FinishesPanel.tsx — unified tab routing effect**

Replace the existing `useEffect` (lines 29-35) in `src/components/ui/finishes/FinishesPanel.tsx`:

```typescript
  // Use a dedicated selector to avoid lint warnings about derived deps
  const selectedElType = useStore((s) => s.selectedElements?.type ?? null);

  // Unified tab routing: face takes priority, then element type
  const prevFace = useRef(selectedFace);
  const prevElType = useRef(selectedElType);
  useEffect(() => {
    const faceChanged = selectedFace !== prevFace.current;
    const elTypeChanged = selectedElType !== prevElType.current;
    prevFace.current = selectedFace;
    prevElType.current = selectedElType;

    if (faceChanged && selectedFace) {
      // Face routing: highest priority
      const tab = faceToTab(selectedFace);
      if (tab) setActiveTab(tab);
    } else if (elTypeChanged && !selectedFace) {
      // Element-type routing: only when no face is set
      if (selectedElType === 'bay' || selectedElType === 'block') {
        setActiveTab('block');
      }
    }
  }, [selectedFace, selectedElType]);
```

Also update `initialTab` to handle element types:

```typescript
  const initialTab = faceToTab(selectedFace)
    ?? (selectedElType === 'bay' || selectedElType === 'block' ? 'block' : 'container');
```

- [ ] **Step 7: Run full test suite + type check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 8: Playwright verification**

Start dev server, place a container:
1. Click a wall face in 3D → Walls tab activates, "WALL SURFACE" options visible
2. Click a floor/baseplate → Flooring tab activates
3. Click roof → Ceiling tab activates
4. Select a bay in the grid (no face click) → Block tab activates
5. Manually click Container tab → stays on Container (no auto-switch overrides)

- [ ] **Step 9: Commit**

```bash
git add src/store/slices/selectionSlice.ts src/components/ui/finishes/FinishesPanel.tsx src/components/objects/ContainerSkin.tsx src/__tests__/selection-elements.test.ts
git commit -m "feat: batched selectWithFace action + unified context-aware tab routing"
```

---

## Task 4a: Hotbar Styling Redesign

**Files:**
- Modify: `src/components/ui/BottomPanel.tsx:88-111` (card styling)
- Modify: `src/components/ui/SmartHotbar.tsx:1127-1154` (slot button styling)

- [ ] **Step 1: Update BottomPanel card styling**

In `src/components/ui/BottomPanel.tsx`, update the `cardStyle` object (around lines 88-111) to match aspirational art:

```typescript
const cardStyle: React.CSSProperties = {
  width: 110,
  height: 100,
  borderRadius: 10,
  border: isSelected
    ? `2px solid ${HIGHLIGHT_COLOR_SELECT}`
    : active
    ? '2px solid #60a5fa'
    : '1px solid rgba(255,255,255,0.12)',
  background: isSelected
    ? 'rgba(0, 188, 212, 0.15)'
    : active
    ? 'rgba(59, 130, 246, 0.2)'
    : 'rgba(30, 40, 30, 0.6)',
  overflow: 'hidden',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  transition: 'border-color 120ms, background 120ms',
};
```

Update the `cardNameStyle` (around lines 113-125) for bold white text:

```typescript
const cardNameStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#fff',
  lineHeight: 1.3,
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  padding: '4px 6px',
};
```

Ensure image area gets rounded top corners:

```typescript
// Image wrapper around the thumbnail
<div style={{
  flex: 1,
  borderRadius: '10px 10px 0 0',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}}>
  {/* thumbnail image */}
</div>
```

- [ ] **Step 2: Verify SmartHotbar slot label color**

In `src/components/ui/SmartHotbar.tsx`, confirm line ~1192 has `color: "#ffffff"` (hardcoded, no conditional). If any slot button backgrounds are too light for white text, darken them. The current background `rgba(0,0,0,0.35)` should be sufficient.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 type errors

- [ ] **Step 4: Playwright verification**

Start dev server:
1. Inspect BottomPanel card labels with `getComputedStyle` → `color: rgb(255, 255, 255)`
2. Inspect SmartHotbar slot labels → `color: rgb(255, 255, 255)`
3. Cards should show visible rounded borders, image area with rounded top corners
4. Selected card should show accent highlight on border only

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/BottomPanel.tsx src/components/ui/SmartHotbar.tsx
git commit -m "style: hotbar card redesign with rounded frames and bold white labels"
```

---

## Task 4b: Ghost Preview (Stamp Mode)

**Files:**
- Modify: `src/store/slices/uiSlice.ts` (add `stampPreview` state + actions)
- Modify: `src/components/objects/HoverPreviewGhost.tsx` (extend for stamp mode)
- Test: `src/__tests__/ghost-preview.test.ts`

- [ ] **Step 1: Write failing test for stampPreview state**

Add to `src/__tests__/ghost-preview.test.ts`:

```typescript
import type { SurfaceType } from '@/types/container';

describe('stampPreview state', () => {
  beforeEach(() => useStore.setState(useStore.getInitialState(), true));

  it('starts null', () => {
    expect(useStore.getState().stampPreview).toBeNull();
  });

  it('setStampPreview stores preview data', () => {
    const preview = { surfaceType: 'Glass' as SurfaceType, containerId: 'c1', voxelIndex: 10 };
    useStore.getState().setStampPreview(preview);
    expect(useStore.getState().stampPreview).toEqual(preview);
  });

  it('clearStampPreview resets to null', () => {
    useStore.getState().setStampPreview({ surfaceType: 'Glass' as SurfaceType, containerId: 'c1', voxelIndex: 10 });
    useStore.getState().clearStampPreview();
    expect(useStore.getState().stampPreview).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/ghost-preview.test.ts`
Expected: FAIL — `stampPreview` / `setStampPreview` / `clearStampPreview` don't exist

- [ ] **Step 3: Add stampPreview state to uiSlice.ts**

In `src/store/slices/uiSlice.ts`, add to the type definition (near the `ghostPreset` section):

```typescript
stampPreview: {
  surfaceType: SurfaceType;
  containerId: string;
  voxelIndex: number;
} | null;
setStampPreview: (p: { surfaceType: SurfaceType; containerId: string; voxelIndex: number } | null) => void;
clearStampPreview: () => void;
```

Add initial state:

```typescript
stampPreview: null,
```

Add actions:

```typescript
setStampPreview: (p) => set({ stampPreview: p }),
clearStampPreview: () => set({ stampPreview: null }),
```

Import `SurfaceType` from `@/types/container` if not already imported.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/ghost-preview.test.ts`
Expected: All tests PASS

- [ ] **Step 5a: Create StampGhost component with face geometry**

In `src/components/objects/HoverPreviewGhost.tsx`, add a new `StampGhost` component. Follow the existing `HoverPreviewGhostInner` pattern (lines 50-127) for reading `hoveredVoxelEdge` and computing face position:

```tsx
const STAMP_COLOR = 0x22c55e; // Green
const stampMat = new THREE.MeshBasicMaterial({
  color: STAMP_COLOR,
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
  side: THREE.DoubleSide,
});

function StampGhost() {
  const stampPreview = useStore((s) => s.stampPreview);
  const hoveredVoxelEdge = useStore((s) => s.hoveredVoxelEdge);
  const meshRef = useRef<THREE.Mesh>(null);

  // Reuse the same face-positioning logic as HoverPreviewGhostInner:
  // hoveredVoxelEdge provides { containerId, voxelIndex, face, position, normal }
  // The position is the face center in world space, normal is the face direction
  if (!stampPreview || !hoveredVoxelEdge) return null;

  const { position, normal } = hoveredVoxelEdge;
  if (!position || !normal) return null;

  // Thin box aligned to the face (0.02 thick in normal direction)
  // Width/height match the voxel face dimensions from ContainerSkin
  // Use dims from CONTAINER_DIMENSIONS based on the container
  return (
    <mesh
      ref={meshRef}
      position={[position.x, position.y, position.z]}
      material={stampMat}
      renderOrder={99}
      raycast={nullRaycast}
    >
      <boxGeometry args={[
        Math.abs(normal.x) > 0.5 ? 0.02 : 2.0,  // thin in normal axis
        Math.abs(normal.y) > 0.5 ? 0.02 : 2.5,
        Math.abs(normal.z) > 0.5 ? 0.02 : 1.2,
      ]} />
    </mesh>
  );
}
```

Note: The exact face dimensions (2.0, 2.5, 1.2) are approximations — the implementer should read the actual voxel dimensions from `CONTAINER_DIMENSIONS[container.size]` and `getVoxelLayout` math (coreW, coreD, vHeight) for precision. The `hoveredVoxelEdge` object structure can be found by searching for where it's set in ContainerSkin/ContainerMesh.

- [ ] **Step 5b: Integrate StampGhost into HoverPreviewGhost return**

Add to the main `HoverPreviewGhost` component's return (around line 46):

```tsx
{stampPreview && <StampGhost />}
```

Also add the store selector at the top of the component:

```tsx
const stampPreview = useStore((s) => s.stampPreview);
```

- [ ] **Step 5c: Add clearStampPreview calls to cleanup locations**

Follow the existing `clearGhostPreset` pattern. Add `clearStampPreview()` calls:
- `FinishesPanel.tsx` — in the close button handler and tab change handler (same places `clearGhostPreset` is called)
- `SmartHotbar.tsx` — when deselecting a hotbar slot
- Add a keyboard listener for Escape key that calls `clearStampPreview()`

- [ ] **Step 6: Run full test suite + type check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 7: Playwright verification**

Start dev server:
1. Select a material in the hotbar (isPlacing = true)
2. Hover over a voxel face in 3D
3. Confirm green-tinted transparent overlay appears on the hovered face
4. Click to apply → material appears, ghost follows cursor to next face
5. Press Escape → ghost disappears

- [ ] **Step 8: Commit**

```bash
git add src/store/slices/uiSlice.ts src/components/objects/HoverPreviewGhost.tsx src/__tests__/ghost-preview.test.ts
git commit -m "feat: ghost preview for stamp mode with green valid-placement tint"
```

---

## Task 5: Wireframe Debug Overlay

**Files:**
- Modify: `src/components/three/DebugOverlay.tsx` (replace EdgesGeometry with wireframe meshes)
- Modify: `src/components/objects/ContainerSkin.tsx` (suppress rendering when debugMode on)

- [ ] **Step 1: Rewrite DebugOverlay to render wireframe meshes**

Replace `src/components/three/DebugOverlay.tsx` entirely:

```tsx
"use client";

/**
 * DebugOverlay.tsx — Wireframe hitbox visualization for all 32 voxels
 *
 * Ported from V2: renders MeshBasicMaterial({ wireframe: true }) directly,
 * not EdgesGeometry lineSegments. Body = red, extension = orange.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS, type Container } from "@/types/container";
import { nullRaycast } from "@/utils/nullRaycast";

// Shared wireframe materials (module-level singletons)
const bodyMat = new THREE.MeshBasicMaterial({
  color: 0xff2222,
  wireframe: true,
  transparent: true,
  opacity: 0.6,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const extMat = new THREE.MeshBasicMaterial({
  color: 0xff8800,
  wireframe: true,
  transparent: true,
  opacity: 0.4,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
});

// Cache box geometries by dimension key
const _geoCache = new Map<string, THREE.BoxGeometry>();
function getBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_geoCache.has(k)) {
    _geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  }
  return _geoCache.get(k)!;
}

// Corner debug dots (NW=red, NE=blue, SW=green, SE=yellow)
const CORNER_COLORS: Record<number, number> = {
  0: 0xff4444,   // NW
  7: 0x4488ff,   // NE
  24: 0x00ff00,  // SW
  31: 0xffcc00,  // SE
};

function ContainerDebugWireframe({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid;
  if (!grid) return null;

  const vHeight = dims.height;
  const coreW = dims.length / 6;
  const coreD = dims.width / 2;
  const foldDepth = dims.height;

  const voxels = useMemo(() => {
    const result: { px: number; py: number; pz: number; w: number; h: number; d: number; isExt: boolean; idx: number }[] = [];

    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (!v.active) continue;

      const row = Math.floor(i / VOXEL_COLS);
      const col = i % VOXEL_COLS;
      const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
      const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
      const isBody = !isHaloCol && !isHaloRow;

      const vW = isHaloCol ? foldDepth : coreW;
      const vD = isHaloRow ? foldDepth : coreD;

      let px: number;
      if (col === 0)                   px = dims.length / 2 + foldDepth / 2;
      else if (col === VOXEL_COLS - 1) px = -(dims.length / 2 + foldDepth / 2);
      else                             px = -(col - 3.5) * coreW;

      let pz: number;
      if (row === 0)                   pz = -(dims.width / 2 + foldDepth / 2);
      else if (row === VOXEL_ROWS - 1) pz = dims.width / 2 + foldDepth / 2;
      else                             pz = (row - 1.5) * coreD;

      result.push({ px, py: vHeight / 2, pz, w: vW, h: vHeight, d: vD, isExt: !isBody, idx: i });
    }
    return result;
  }, [grid, coreW, coreD, foldDepth, vHeight, dims.length, dims.width]);

  return (
    <group position={[container.position.x, container.position.y, container.position.z]}>
      {voxels.map((v, i) => (
        <mesh
          key={i}
          position={[v.px, v.py, v.pz]}
          geometry={getBox(v.w, v.h, v.d)}
          material={v.isExt ? extMat : bodyMat}
          renderOrder={100}
          raycast={nullRaycast}
        />
      ))}
      {/* Corner debug dots — positioned at top of voxel box + small offset */}
      {voxels.filter(v => CORNER_COLORS[v.idx] !== undefined).map(v => (
        <mesh key={`dot-${v.idx}`} position={[v.px, v.py + v.h / 2 + 0.2, v.pz]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={CORNER_COLORS[v.idx]} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}

export default function DebugOverlay() {
  const containers = useStore((s) => s.containers);

  return (
    <group>
      {Object.values(containers).map((c) => (
        <ContainerDebugWireframe key={c.id} container={c} />
      ))}
    </group>
  );
}
```

Key changes from original:
- `lineSegments` + `EdgesGeometry` → `mesh` + `BoxGeometry` + `MeshBasicMaterial({ wireframe: true })`
- Extension voxels no longer skipped — all 32 rendered
- Corner debug dots added
- Extension halo dimensions computed correctly (foldDepth for halo cols/rows)

- [ ] **Step 2: Suppress ContainerSkin rendering when debugMode is ON**

In `src/components/objects/ContainerSkin.tsx`, find the main render/return of the ContainerSkin component. Add an early check:

```typescript
const debugMode = useStore((s) => s.debugMode);
```

Then wrap the main rendering group:

```tsx
{/* Skip skin rendering in debug mode — DebugOverlay shows wireframes instead */}
{!debugMode && (
  <group>
    {/* ... all existing face meshes, edge strips, baseplates, halo geometry ... */}
  </group>
)}
{/* Selection highlight and hover highlight still render in debug mode */}
{/* Keep these OUTSIDE the !debugMode guard */}
```

Be careful to only suppress the skin meshes / edge strips / baseplates. Selection highlights and hover highlights must remain visible. Find the JSX sections for selection rendering and keep them outside the `!debugMode` conditional.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 type errors

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (wireframe changes are visual-only)

- [ ] **Step 5: Playwright verification**

Start dev server, place a container:
1. Toggle wireframe/debug mode ON (find the toggle in settings or use the keyboard shortcut)
2. Confirm: single clean set of wireframe outlines (no doubled lines)
3. Confirm: body voxels in red, extension voxels in orange
4. Confirm: colored corner dots visible (red NW, blue NE, green SW, yellow SE)
5. Toggle wireframe OFF → normal container rendering returns completely

- [ ] **Step 6: Commit**

```bash
git add src/components/three/DebugOverlay.tsx src/components/objects/ContainerSkin.tsx
git commit -m "fix: port V2 wireframe debug with all 32 voxels, suppress skin in debug mode"
```

---

## Post-Implementation Checklist

After all 6 tasks are complete:

- [ ] Run `npx tsc --noEmit` → 0 errors
- [ ] Run `npx vitest run` → all tests pass
- [ ] Run `node acceptance-gates.mjs` → all gates pass (if available)
- [ ] Browser walkthrough of all 5 fixes + ghost preview
- [ ] Update `MODUHOME-V1-ARCHITECTURE-v2.md` if architectural state changed (selectWithFace action, stampPreview state)
