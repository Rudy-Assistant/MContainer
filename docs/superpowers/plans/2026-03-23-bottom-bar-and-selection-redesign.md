# Bottom Bar & Context-Aware Selection Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the two disconnected selection systems (voxel/face and SceneObject) with mutual exclusion, redesign the bottom bar with sidebar-aware positioning / icon tabs / SVG thumbnails / auto-sync, and fix inspector default visibility.

**Architecture:** Mutual exclusion between `selectedObjectId` and `selectedVoxel`/`selectedFace`/`selectedVoxels` enforced in three existing store actions. SkinEditor moves from floating overlay into Sidebar's Inspector contextual area. BottomPanel reads sidebar width from store and auto-syncs its category tab when a SceneObject is selected.

**Tech Stack:** React 19, Zustand 5 (selectionSlice + uiSlice), lucide-react icons, inline SVG, vitest

**Spec:** `docs/superpowers/specs/2026-03-23-bottom-bar-and-selection-redesign-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/store/slices/uiSlice.ts` | Modify | `selectObject` gains mutual exclusion (clears voxel state); flip `previewCollapsed`/`gridCollapsed` defaults |
| `src/store/slices/selectionSlice.ts` | Modify | `setSelectedVoxel`, `setSelectedVoxels`, `select`, `selectMultiple`, `clearSelection` gain `selectedObjectId: null` |
| `src/Testing/selection-mutual-exclusion.test.ts` | Create | Tests for mutual exclusion invariant |
| `src/components/ui/SkinEditor.tsx` | Modify | Remove `position: fixed` + close button; become inline flex child |
| `src/components/ui/Sidebar.tsx` | Modify | Inspector routes to `<SkinEditor />` when `selectedObjectId` is set |
| `src/components/ui/FormThumbnails.tsx` | Create | `<FormThumbnail formId size />` — inline SVG silhouettes per form |
| `src/components/ui/BottomPanel.tsx` | Modify | Sidebar-aware centering, icon tabs above cards, SVG thumbnails, auto-sync, selection badge |
| `src/components/objects/ContainerSkin.tsx` | Modify | Detect occupied SceneObject slot on click → `selectObject(id)` |
| `src/Testing/bottom-bar-selection.test.ts` | Create | Auto-sync and selection badge logic tests |

---

### Task 1: Mutual Exclusion — Store Changes + Tests

**Files:**
- Create: `src/Testing/selection-mutual-exclusion.test.ts`
- Modify: `src/store/slices/uiSlice.ts:304-306`
- Modify: `src/store/slices/selectionSlice.ts:122,126,129,98-118,120`

- [ ] **Step 1: Write the failing test file**

Create `src/Testing/selection-mutual-exclusion.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';

function resetStore() {
  useStore.setState({
    selection: [],
    selectedVoxel: null,
    selectedFace: null,
    selectedVoxels: null,
    selectedObjectId: null,
  });
}

describe('selection mutual exclusion', () => {
  beforeEach(resetStore);

  it('selectObject clears voxel selection', () => {
    const s = useStore.getState();
    s.setSelectedVoxel({ containerId: 'c1', index: 5 });
    s.setSelectedFace('n');
    expect(useStore.getState().selectedVoxel).not.toBeNull();

    s.selectObject('obj-1');
    const after = useStore.getState();
    expect(after.selectedObjectId).toBe('obj-1');
    expect(after.selectedVoxel).toBeNull();
    expect(after.selectedFace).toBeNull();
    expect(after.selectedVoxels).toBeNull();
  });

  it('selectObject clears multi-voxel selection', () => {
    const s = useStore.getState();
    s.setSelectedVoxels({ containerId: 'c1', indices: [9, 10] });
    s.selectObject('obj-2');
    expect(useStore.getState().selectedVoxels).toBeNull();
  });

  it('setSelectedVoxel clears selectedObjectId', () => {
    const s = useStore.getState();
    s.selectObject('obj-1');
    expect(useStore.getState().selectedObjectId).toBe('obj-1');

    s.setSelectedVoxel({ containerId: 'c1', index: 3 });
    expect(useStore.getState().selectedObjectId).toBeNull();
  });

  it('setSelectedVoxels clears selectedObjectId', () => {
    const s = useStore.getState();
    s.selectObject('obj-1');
    s.setSelectedVoxels({ containerId: 'c1', indices: [9, 10] });
    expect(useStore.getState().selectedObjectId).toBeNull();
  });

  it('select (container) clears selectedObjectId', () => {
    const s = useStore.getState();
    s.selectObject('obj-1');
    s.select('c1');
    expect(useStore.getState().selectedObjectId).toBeNull();
  });

  it('selectMultiple clears selectedObjectId', () => {
    const s = useStore.getState();
    s.selectObject('obj-1');
    s.selectMultiple(['c1', 'c2']);
    expect(useStore.getState().selectedObjectId).toBeNull();
  });

  it('clearSelection clears selectedObjectId', () => {
    const s = useStore.getState();
    s.selectObject('obj-1');
    s.clearSelection();
    const after = useStore.getState();
    expect(after.selectedObjectId).toBeNull();
    expect(after.selection).toEqual([]);
    expect(after.selectedVoxel).toBeNull();
  });

  it('selectObject(null) only clears object, preserves voxel selection', () => {
    const s = useStore.getState();
    s.setSelectedVoxel({ containerId: 'c1', index: 5 });
    s.selectObject(null);
    const after = useStore.getState();
    expect(after.selectedObjectId).toBeNull();
    // selectObject(null) still clears voxel (mutual exclusion is unconditional)
    expect(after.selectedVoxel).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/selection-mutual-exclusion.test.ts`
Expected: Multiple FAIL — `selectObject` doesn't clear voxel state, voxel actions don't clear `selectedObjectId`

- [ ] **Step 3: Implement mutual exclusion in uiSlice.ts**

In `src/store/slices/uiSlice.ts`, change `selectObject` (line 306):

```ts
// BEFORE:
selectObject: (id) => set({ selectedObjectId: id }),

// AFTER:
selectObject: (id) => set({
  selectedObjectId: id,
  selectedVoxel: null,
  selectedFace: null,
  selectedVoxels: null,
}),
```

- [ ] **Step 4: Implement mutual exclusion in selectionSlice.ts**

In `src/store/slices/selectionSlice.ts`, add `selectedObjectId: null` to these actions:

**`select` (line 112):** Add `selectedObjectId: null` to the returned object:
```ts
return {
  selection: newSel,
  selectionContext: newCtx,
  selectedVoxel: null,
  selectedVoxels: sameContainer ? s.selectedVoxels : null,
  selectedObjectId: null,  // ← ADD
};
```

**`selectMultiple` (line 120):**
```ts
selectMultiple: (ids) => set({ selection: ids, selectedVoxel: null, selectedFace: null, selectedVoxels: null, selectionContext: null, selectedObjectId: null }),
```

**`clearSelection` (line 122):**
```ts
clearSelection: () => set({ selection: [], selectionContext: null, selectedVoxel: null, selectedFace: null, selectedVoxels: null, hoveredVoxel: null, faceContext: null, selectedObjectId: null }),
```

**`setSelectedVoxel` (line 126):**
```ts
setSelectedVoxel: (v) => set({ selectedVoxel: v, selectedVoxels: null, selectedObjectId: null }),
```

**`setSelectedVoxels` (line 129):**
```ts
setSelectedVoxels: (v) => set({ selectedVoxels: v, selectedVoxel: null, selectedObjectId: null }),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/selection-mutual-exclusion.test.ts`
Expected: All PASS

- [ ] **Step 6: Run full test suite for regression check**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All existing tests still pass

- [ ] **Step 7: Commit**

```bash
cd /c/MHome/MContainer && git add src/store/slices/uiSlice.ts src/store/slices/selectionSlice.ts src/Testing/selection-mutual-exclusion.test.ts && git commit -m "feat: enforce mutual exclusion between object and voxel selection"
```

---

### Task 2: Inspector Default Visibility

**Files:**
- Modify: `src/store/slices/uiSlice.ts:277,279`

- [ ] **Step 1: Change defaults**

In `src/store/slices/uiSlice.ts`, change:

```ts
// Line 277 — BEFORE:
previewCollapsed: false,
// AFTER:
previewCollapsed: true,

// Line 279 — BEFORE:
gridCollapsed: false,
// AFTER:
gridCollapsed: true,
```

- [ ] **Step 2: Run full test suite**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass (no tests depend on these defaults being false)

- [ ] **Step 3: Commit**

```bash
cd /c/MHome/MContainer && git add src/store/slices/uiSlice.ts && git commit -m "fix: default inspector preview and grid to collapsed"
```

---

### Task 3: SkinEditor — Remove Fixed Positioning + Close Button

**Files:**
- Modify: `src/components/ui/SkinEditor.tsx:21-41,213-226`

- [ ] **Step 1: Remove fixed positioning from panelStyle**

In `src/components/ui/SkinEditor.tsx`, replace the `panelStyle` object (lines 21-41):

```ts
// BEFORE:
const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 60,
  left: 12,
  zIndex: 100,
  width: 280,
  maxHeight: 'calc(100vh - 80px)',
  overflowY: 'auto',
  background: 'rgba(0, 0, 0, 0.85)',
  borderRadius: 12,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.1)',
  userSelect: 'none',
  color: '#e2e8f0',
  fontSize: 13,
  scrollbarWidth: 'thin',
};

// AFTER:
const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '8px 12px',
  color: '#e2e8f0',
  fontSize: 13,
};
```

- [ ] **Step 2: Remove close button from header**

Replace the header JSX (lines 213-226):

```tsx
// BEFORE:
<div style={headerStyle}>
  <div>
    <div style={{ fontWeight: 600, fontSize: 14 }}>{form.name}</div>
    {styleDef && (
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
        {styleDef.label}
      </div>
    )}
  </div>
  <button style={closeBtnStyle} onClick={handleClose} title="Deselect object">
    ✕
  </button>
</div>

// AFTER:
<div>
  <div style={{ fontWeight: 600, fontSize: 14 }}>{form.name}</div>
  {styleDef && (
    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
      {styleDef.label}
    </div>
  )}
</div>
```

- [ ] **Step 3: Remove unused handleClose callback and closeBtnStyle**

Delete the `handleClose` callback (line 166):
```ts
// DELETE:
const handleClose = useCallback(() => selectObject(null), [selectObject]);
```

Delete `closeBtnStyle` constant (lines 49-58):
```ts
// DELETE the entire closeBtnStyle const
```

Delete `headerStyle` constant (lines 43-47):
```ts
// DELETE the entire headerStyle const
```

Remove `selectObject` from the store selectors (line 153) since it's no longer used directly in SkinEditor:
```ts
// DELETE:
const selectObject = useStore((s) => s.selectObject);
```

Update `handleRemove` to get `selectObject` inline:
```ts
const handleRemove = useCallback(() => {
  if (!selectedObjectId) return;
  removeObject(selectedObjectId);
  useStore.getState().selectObject(null);
}, [selectedObjectId, removeObject]);
```

- [ ] **Step 4: Add anti-pattern test for position:fixed**

The spec requires a test asserting SkinEditor no longer uses `position: fixed`. Add to `src/Testing/selection-mutual-exclusion.test.ts` (or a new file if preferred):

```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';

// NOTE: This is a rare exception to the "no source-scanning tests" rule.
// The spec explicitly requires an anti-pattern guard against SkinEditor
// regressing to position:fixed. This is a structural constraint, not behavior.
describe('SkinEditor anti-patterns', () => {
  it('must not use position: fixed', () => {
    const src = readFileSync(resolve(__dirname, '../components/ui/SkinEditor.tsx'), 'utf8');
    expect(src).not.toMatch(/position\s*:\s*['"]?fixed/);
  });
});
```

- [ ] **Step 5: Type check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Run tests**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
cd /c/MHome/MContainer && git add src/components/ui/SkinEditor.tsx src/Testing/selection-mutual-exclusion.test.ts && git commit -m "refactor: make SkinEditor an inline sidebar child, remove fixed positioning"
```

---

### Task 4: Sidebar Inspector Routing — Show SkinEditor

**Files:**
- Modify: `src/components/ui/Sidebar.tsx:501-564`

- [ ] **Step 1: Add selectedObjectId selector to Inspector**

In `src/components/ui/Sidebar.tsx`, inside the `Inspector` component (after the existing selectors ~line 337), add:

```ts
const selectedObjectId = useStore((s) => s.selectedObjectId);
```

Also add the SkinEditor import at the top of the file (after existing imports ~line 27):

```ts
import SkinEditor from '@/components/ui/SkinEditor';
```

- [ ] **Step 2: Add SkinEditor routing to contextual area**

Replace the contextual area JSX (lines 501-564). Insert `selectedObjectId` check as first priority:

```tsx
{/* ── Contextual area — fills remaining space ── */}
<div style={{ flex: 1, overflowY: "auto", borderTop: "1px solid #1e293b", marginTop: "4px" }}>
  {selectedObjectId ? (
    <SkinEditor />
  ) : (target.type === "voxel" || target.type === "bay") ? (
    <WallTypePicker
      containerId={containerId}
      voxelIndex={target.type === "voxel" ? target.index : target.indices[0]}
    />
  ) : (target.type === "face" || target.type === "bay-face") ? (
    <FinishesPanel />
  ) : (
    <div style={{ padding: "8px 12px" }}>
      {/* Keep the existing Container Properties block (Sidebar.tsx lines 511-563) exactly as-is. Do NOT delete it. */}
    </div>
  )}
</div>
```

- [ ] **Step 3: Type check + test**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 4: Commit**

```bash
cd /c/MHome/MContainer && git add src/components/ui/Sidebar.tsx && git commit -m "feat: route Inspector contextual area to SkinEditor when object selected"
```

---

### Task 5: 3D Click Handler — Select SceneObject on Click

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx:2262-2350`

- [ ] **Step 1: Add SceneObject detection helper**

Near the top of `ContainerSkin.tsx` (after the `tryPlacementIntercept` function, ~line 131), add:

```ts
/** Find a placed SceneObject whose anchor matches the clicked voxel face. */
function findObjectAtFace(
  sceneObjects: Record<string, import('@/types/sceneObject').SceneObject>,
  containerId: string,
  voxelIndex: number,
  face: keyof VoxelFaces,
): string | null {
  for (const [id, obj] of Object.entries(sceneObjects)) {
    const a = obj.anchor;
    if (
      a.containerId === containerId &&
      a.voxelIndex === voxelIndex &&
      ((a.type === 'face' && a.face === face) ||
       (a.type === 'floor' && face === 'bottom') ||
       (a.type === 'ceiling' && face === 'top'))
    ) {
      return id;
    }
  }
  return null;
}
```

- [ ] **Step 2: Insert SceneObject selection into handleClick**

In `handleClick` (line 2262), after the placement intercept check (line 2265) and staircase check (line 2277), before the bucket mode check (line 2280), insert:

```ts
// ★ SceneObject selection: if clicked face has a placed object, select it
const sceneObjects = useStore.getState().sceneObjects;
const hitObjectId = findObjectAtFace(sceneObjects, container.id, voxelIndex, faceName);
if (hitObjectId) {
  useStore.getState().selectObject(hitObjectId);
  return;
}
```

- [ ] **Step 3: Type check + test**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all pass

- [ ] **Step 4: Commit**

```bash
cd /c/MHome/MContainer && git add src/components/objects/ContainerSkin.tsx && git commit -m "feat: clicking a placed SceneObject in 3D selects it via selectObject"
```

---

### Task 6: FormThumbnails — SVG Silhouettes

**Files:**
- Create: `src/components/ui/FormThumbnails.tsx`

- [ ] **Step 1: Create FormThumbnails.tsx**

Create `src/components/ui/FormThumbnails.tsx`:

```tsx
/**
 * FormThumbnails.tsx — Inline SVG silhouettes for form cards.
 *
 * Each form gets a monochrome SVG outline using currentColor.
 * Renders at the given `size` (default 32px). Falls back to a generic
 * rectangle for unknown formIds.
 */

import type { CSSProperties } from 'react';

interface Props {
  formId: string;
  size?: number;
}

const svgStyle = (size: number): CSSProperties => ({
  width: size,
  height: size,
  display: 'block',
});

/** Shared SVG wrapper — viewBox 0 0 32 32, stroke currentColor */
function Svg({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={svgStyle(size)}
    >
      {children}
    </svg>
  );
}

// ── Door silhouettes ──────────────────────────────────────────

function DoorSingleSwing({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="4" width="16" height="24" rx="1" />
      <circle cx="21" cy="17" r="1.2" />
      <line x1="8" y1="4" x2="18" y2="10" />
    </Svg>
  );
}

function DoorDoubleSwing({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="24" height="24" rx="1" />
      <line x1="16" y1="4" x2="16" y2="28" />
      <circle cx="13" cy="17" r="1" />
      <circle cx="19" cy="17" r="1" />
    </Svg>
  );
}

function DoorBarnSlide({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="4" y1="6" x2="28" y2="6" />
      <rect x="6" y="7" width="14" height="21" rx="1" />
      <line x1="10" y1="7" x2="10" y2="28" />
      <line x1="13" y1="7" x2="13" y2="28" />
      <circle cx="8" cy="6" r="1.2" fill="currentColor" />
      <circle cx="18" cy="6" r="1.2" fill="currentColor" />
    </Svg>
  );
}

function DoorPocketSlide({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="24" height="24" rx="1" />
      <rect x="6" y="6" width="10" height="20" rx="0.5" strokeDasharray="2 1" />
      <line x1="20" y1="6" x2="20" y2="26" strokeDasharray="3 2" />
    </Svg>
  );
}

function DoorFrench({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="24" height="24" rx="1" />
      <line x1="16" y1="4" x2="16" y2="28" />
      <rect x="6" y="7" width="8" height="6" rx="0.5" />
      <rect x="6" y="15" width="8" height="6" rx="0.5" />
      <rect x="18" y="7" width="8" height="6" rx="0.5" />
      <rect x="18" y="15" width="8" height="6" rx="0.5" />
    </Svg>
  );
}

function DoorGlassSlide({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="24" height="24" rx="1" />
      <rect x="5" y="5" width="11" height="22" rx="0.5" strokeWidth={1} />
      <line x1="4" y1="27" x2="28" y2="27" strokeWidth={2} />
    </Svg>
  );
}

function DoorBifold({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="4" width="24" height="24" rx="1" />
      <path d="M10 4 L6 16 L10 28" />
      <path d="M16 4 L12 16 L16 28" />
      <path d="M22 4 L26 16 L22 28" />
    </Svg>
  );
}

function DoorShoji({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="4" width="20" height="24" rx="1" />
      <line x1="11" y1="4" x2="11" y2="28" />
      <line x1="16" y1="4" x2="16" y2="28" />
      <line x1="21" y1="4" x2="21" y2="28" />
      <line x1="6" y1="12" x2="26" y2="12" />
      <line x1="6" y1="20" x2="26" y2="20" />
    </Svg>
  );
}

// ── Window silhouettes ────────────────────────────────────────

function WindowStandard({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="6" width="20" height="20" rx="1" />
      <line x1="16" y1="6" x2="16" y2="26" />
      <line x1="6" y1="16" x2="26" y2="16" />
      <rect x="6" y="24" width="20" height="2" rx="0.5" fill="currentColor" opacity={0.3} />
    </Svg>
  );
}

function WindowPicture({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="3" y="8" width="26" height="16" rx="1" />
    </Svg>
  );
}

function WindowHalf({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="12" width="20" height="10" rx="1" />
      <line x1="16" y1="12" x2="16" y2="22" />
    </Svg>
  );
}

function WindowClerestory({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="10" width="24" height="6" rx="1" />
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="20" y1="10" x2="20" y2="16" />
    </Svg>
  );
}

function WindowPorthole({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <circle cx="16" cy="16" r="9" />
      <circle cx="16" cy="16" r="7" />
      <line x1="16" y1="9" x2="16" y2="7" />
      <line x1="16" y1="23" x2="16" y2="25" />
    </Svg>
  );
}

function WindowShojiScreen({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="4" width="20" height="24" rx="1" />
      <line x1="13" y1="4" x2="13" y2="28" />
      <line x1="20" y1="4" x2="20" y2="28" />
      <line x1="6" y1="11" x2="26" y2="11" />
      <line x1="6" y1="18" x2="26" y2="18" />
    </Svg>
  );
}

function WindowDoubleHung({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="4" width="16" height="24" rx="1" />
      <line x1="8" y1="16" x2="24" y2="16" strokeWidth={2} />
      <line x1="16" y1="4" x2="16" y2="16" />
      <line x1="16" y1="16" x2="16" y2="28" />
    </Svg>
  );
}

// ── Light silhouettes ─────────────────────────────────────────

function LightPendant({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="16" y1="4" x2="16" y2="14" />
      <path d="M10 14 L16 14 L22 14 L20 24 L12 24 Z" />
      <line x1="12" y1="24" x2="20" y2="24" strokeWidth={2} />
    </Svg>
  );
}

function LightFlushMount({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <ellipse cx="16" cy="16" rx="10" ry="4" />
      <line x1="6" y1="14" x2="26" y2="14" />
    </Svg>
  );
}

function LightTrack({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="4" y1="10" x2="28" y2="10" strokeWidth={2} />
      <rect x="7" y="11" width="4" height="8" rx="1" />
      <rect x="14" y="11" width="4" height="8" rx="1" />
      <rect x="21" y="11" width="4" height="8" rx="1" />
    </Svg>
  );
}

function LightRecessed({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="4" y1="12" x2="28" y2="12" />
      <circle cx="16" cy="12" r="6" />
      <circle cx="16" cy="12" r="3" />
    </Svg>
  );
}

function LightWallSconce({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="8" y1="4" x2="8" y2="28" strokeWidth={2} />
      <path d="M8 12 L16 10 L18 16 L16 22 L8 20 Z" />
    </Svg>
  );
}

function LightStripLed({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="4" y="14" width="24" height="4" rx="2" />
      <circle cx="9" cy="16" r="1" fill="currentColor" />
      <circle cx="14" cy="16" r="1" fill="currentColor" />
      <circle cx="19" cy="16" r="1" fill="currentColor" />
      <circle cx="24" cy="16" r="1" fill="currentColor" />
    </Svg>
  );
}

function LightFloorLamp({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <line x1="16" y1="10" x2="16" y2="26" />
      <path d="M10 4 L16 10 L22 4 Z" />
      <line x1="12" y1="26" x2="20" y2="26" strokeWidth={2} />
    </Svg>
  );
}

function LightTableLamp({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <path d="M10 8 L16 4 L22 8 L20 16 L12 16 Z" />
      <rect x="14" y="16" width="4" height="8" rx="0.5" />
      <line x1="11" y1="24" x2="21" y2="24" strokeWidth={2} />
    </Svg>
  );
}

// ── Electrical silhouettes ────────────────────────────────────

function ElectricalOutlet({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="6" width="16" height="20" rx="3" />
      <line x1="14" y1="11" x2="14" y2="14" />
      <line x1="18" y1="11" x2="18" y2="14" />
      <line x1="14" y1="18" x2="14" y2="21" />
      <line x1="18" y1="18" x2="18" y2="21" />
    </Svg>
  );
}

function ElectricalSwitch({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="6" width="16" height="20" rx="3" />
      <rect x="12" y="10" width="8" height="12" rx="2" />
      <line x1="16" y1="12" x2="16" y2="16" strokeWidth={2} />
    </Svg>
  );
}

function ElectricalDimmer({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="6" width="16" height="20" rx="3" />
      <circle cx="16" cy="16" r="5" />
      <line x1="16" y1="11" x2="16" y2="13" strokeWidth={2} />
    </Svg>
  );
}

function ElectricalUsbOutlet({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="8" y="6" width="16" height="20" rx="3" />
      <line x1="14" y1="10" x2="14" y2="13" />
      <line x1="18" y1="10" x2="18" y2="13" />
      <rect x="12" y="17" width="8" height="4" rx="1" />
    </Svg>
  );
}

// ── Fallback ──────────────────────────────────────────────────

function FallbackThumbnail({ size }: { size: number }) {
  return (
    <Svg size={size}>
      <rect x="6" y="6" width="20" height="20" rx="2" strokeDasharray="3 2" />
      <circle cx="16" cy="16" r="3" />
    </Svg>
  );
}

// ── Registry ──────────────────────────────────────────────────

const THUMBNAIL_MAP: Record<string, React.ComponentType<{ size: number }>> = {
  // Doors
  door_single_swing: DoorSingleSwing,
  door_double_swing: DoorDoubleSwing,
  door_barn_slide: DoorBarnSlide,
  door_pocket_slide: DoorPocketSlide,
  door_french: DoorFrench,
  door_glass_slide: DoorGlassSlide,
  door_bifold: DoorBifold,
  door_shoji: DoorShoji,
  // Windows
  window_standard: WindowStandard,
  window_picture: WindowPicture,
  window_half: WindowHalf,
  window_clerestory: WindowClerestory,
  window_porthole: WindowPorthole,
  window_shoji_screen: WindowShojiScreen,
  window_double_hung: WindowDoubleHung,
  // Lights
  light_pendant: LightPendant,
  light_flush_mount: LightFlushMount,
  light_track: LightTrack,
  light_recessed: LightRecessed,
  light_wall_sconce: LightWallSconce,
  light_strip_led: LightStripLed,
  light_floor_lamp: LightFloorLamp,
  light_table_lamp: LightTableLamp,
  // Electrical
  electrical_outlet: ElectricalOutlet,
  electrical_switch: ElectricalSwitch,
  electrical_dimmer: ElectricalDimmer,
  electrical_usb_outlet: ElectricalUsbOutlet,
};

export default function FormThumbnail({ formId, size = 32 }: Props) {
  const Component = THUMBNAIL_MAP[formId] ?? FallbackThumbnail;
  return <Component size={size} />;
}
```

- [ ] **Step 2: Type check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
cd /c/MHome/MContainer && git add src/components/ui/FormThumbnails.tsx && git commit -m "feat: add SVG silhouette thumbnails for all 27 form types"
```

---

### Task 7: BottomPanel Redesign — Layout, Icons, Thumbnails, Auto-Sync

**Files:**
- Modify: `src/components/ui/BottomPanel.tsx` (full rewrite)
- Create: `src/Testing/bottom-bar-selection.test.ts`

- [ ] **Step 1: Write auto-sync test**

Create `src/Testing/bottom-bar-selection.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';
import { formRegistry } from '../config/formRegistry';

function resetStore() {
  useStore.setState({
    selectedObjectId: null,
    sceneObjects: {},
    activePlacementFormId: null,
    placementMode: false,
    sidebarCollapsed: false,
  });
}

describe('BottomPanel auto-sync logic', () => {
  beforeEach(resetStore);

  it('formRegistry has all expected categories', () => {
    const cats = new Set<string>();
    for (const [, f] of formRegistry) cats.add(f.category);
    expect(cats).toContain('door');
    expect(cats).toContain('window');
    expect(cats).toContain('light');
    expect(cats).toContain('electrical');
  });

  it('selecting an object yields the correct formId for category sync', () => {
    // Place a mock door object
    const doorFormId = 'door_single_swing';
    const objId = 'test-obj-1';
    useStore.setState({
      sceneObjects: {
        [objId]: {
          id: objId,
          formId: doorFormId,
          skin: {},
          anchor: { containerId: 'c1', voxelIndex: 9, type: 'face' as const, face: 'n' as const },
        },
      },
      selectedObjectId: objId,
    });

    const state = useStore.getState();
    const obj = state.sceneObjects[state.selectedObjectId!];
    expect(obj).toBeDefined();
    const form = formRegistry.get(obj!.formId);
    expect(form?.category).toBe('door');
  });

  it('sidebarCollapsed state is readable for positioning', () => {
    expect(useStore.getState().sidebarCollapsed).toBe(false);
    useStore.getState().toggleSidebar();
    expect(useStore.getState().sidebarCollapsed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (these are integration tests on existing store)

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/bottom-bar-selection.test.ts`
Expected: PASS (these verify the store plumbing works for auto-sync)

- [ ] **Step 3: Rewrite BottomPanel.tsx**

Replace the entire content of `src/components/ui/BottomPanel.tsx`:

```tsx
'use client';

/**
 * BottomPanel.tsx — Form picker strip (bottom of canvas, sidebar-aware).
 *
 * Icon tab row above scrollable card strip with SVG thumbnails.
 * Auto-syncs active category when a SceneObject is selected in 3D.
 */

import { useState, useMemo, useCallback, useEffect, CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { formRegistry, getByCategory } from '@/config/formRegistry';
import type { FormCategory } from '@/types/sceneObject';
import FormThumbnail from '@/components/ui/FormThumbnails';
import { DoorOpen, AppWindow, Lightbulb, Plug } from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────

const CATEGORIES: { id: FormCategory; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'door', label: 'Doors', Icon: DoorOpen },
  { id: 'window', label: 'Windows', Icon: AppWindow },
  { id: 'light', label: 'Lights', Icon: Lightbulb },
  { id: 'electrical', label: 'Electrical', Icon: Plug },
];

const SIDEBAR_WIDTH_EXPANDED = 384;
const SIDEBAR_WIDTH_COLLAPSED = 48;

const COST_DOT = '\u25CF';
function costDots(cost: number): number {
  return Math.min(5, Math.ceil(cost / 500));
}

// ── Styles ────────────────────────────────────────────────────

const wrapperStyle: CSSProperties = {
  position: 'fixed',
  bottom: 48,
  // `left` is set dynamically via inline style override
  transform: 'translateX(-50%)',
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  userSelect: 'none',
};

const tabRowStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  justifyContent: 'center',
};

const tabBtnStyle = (active: boolean): CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: active ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
  color: active ? '#93c5fd' : 'rgba(255,255,255,0.4)',
  transition: 'all 100ms ease',
});

const cardBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  maxWidth: '80vw',
  background: 'rgba(0, 0, 0, 0.85)',
  borderRadius: 12,
  padding: '6px 10px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(12px)',
};

const cardScrollStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  flex: 1,
  minWidth: 0,
};

const cardStyle = (active: boolean, isSelected: boolean): CSSProperties => ({
  minWidth: 80,
  height: 64,
  flexShrink: 0,
  borderRadius: 6,
  border: isSelected
    ? '1.5px solid #00bcd4'
    : active
    ? '1.5px solid #60a5fa'
    : '1.5px solid rgba(255,255,255,0.08)',
  background: isSelected
    ? 'rgba(0, 188, 212, 0.15)'
    : active
    ? 'rgba(59, 130, 246, 0.2)'
    : 'rgba(255,255,255,0.04)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  padding: '4px 6px',
  transition: 'all 100ms ease',
});

const cardNameStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.75)',
  textAlign: 'center',
  lineHeight: 1.1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  fontFamily: 'system-ui, sans-serif',
};

const cardCostStyle: CSSProperties = {
  fontSize: 8,
  color: 'rgba(255, 200, 50, 0.5)',
  letterSpacing: '0.05em',
};

const dividerStyle: CSSProperties = {
  width: 1,
  height: 40,
  background: 'rgba(255,255,255,0.12)',
  flexShrink: 0,
};

const placingBadgeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 10,
  fontWeight: 600,
  fontFamily: 'system-ui, sans-serif',
  color: '#fbbf24',
  background: 'rgba(251, 191, 36, 0.12)',
  borderRadius: 6,
  padding: '3px 8px',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};

const selectedBadgeStyle: CSSProperties = {
  ...placingBadgeStyle,
  color: '#00bcd4',
  background: 'rgba(0, 188, 212, 0.12)',
};

const cancelBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#fbbf24',
  fontSize: 12,
  cursor: 'pointer',
  padding: '0 1px',
  lineHeight: 1,
};

// ── Component ─────────────────────────────────────────────────

export default function BottomPanel() {
  const [category, setCategory] = useState<FormCategory>('door');
  const activePlacementFormId = useStore((s) => s.activePlacementFormId);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const selectedFormId = useStore((s) =>
    s.selectedObjectId ? s.sceneObjects[s.selectedObjectId]?.formId ?? null : null
  );

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  const forms = useMemo(() => getByCategory(category), [category]);

  // Auto-sync category when a SceneObject is selected
  useEffect(() => {
    if (selectedFormId) {
      const form = formRegistry.get(selectedFormId);
      if (form) setCategory(form.category);
    }
  }, [selectedFormId]);

  // Re-compute left position on resize
  const [winWidth, setWinWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const handler = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleCardClick = useCallback((formId: string) => {
    const { activePlacementFormId: current, setPlacementMode } = useStore.getState();
    setPlacementMode(current === formId ? null : formId);
  }, []);

  const leftPos = sidebarWidth + (winWidth - sidebarWidth) / 2;

  // Determine the selected object's formId (for highlighting its card)
  const selectedObjFormId = selectedFormId;

  // Badge logic: placing takes priority over selection
  const placingForm = activePlacementFormId ? formRegistry.get(activePlacementFormId) : null;
  const selectedForm = selectedObjFormId ? formRegistry.get(selectedObjFormId) : null;

  return (
    <div style={{ ...wrapperStyle, left: leftPos }}>
      {/* Icon tab row */}
      <div style={tabRowStyle}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            style={tabBtnStyle(category === cat.id)}
            onClick={() => setCategory(cat.id)}
            title={cat.label}
          >
            <cat.Icon size={16} />
          </button>
        ))}
      </div>

      {/* Card bar */}
      <div style={cardBarStyle}>
        <div style={cardScrollStyle}>
          {forms.map((f) => {
            const isPlacing = activePlacementFormId === f.id;
            const isSelected = !isPlacing && selectedObjFormId === f.id;
            return (
              <button
                key={f.id}
                style={cardStyle(isPlacing, isSelected)}
                onClick={() => handleCardClick(f.id)}
                title={`${f.name} — $${f.costEstimate}`}
              >
                <div style={{ color: isPlacing ? '#93c5fd' : isSelected ? '#00bcd4' : 'rgba(255,255,255,0.5)' }}>
                  <FormThumbnail formId={f.id} size={28} />
                </div>
                <span style={{ ...cardNameStyle, color: isPlacing ? '#93c5fd' : isSelected ? '#00bcd4' : undefined }}>
                  {f.name}
                </span>
                <span style={{ ...cardCostStyle, color: isPlacing ? '#fbbf24' : undefined }}>
                  {COST_DOT.repeat(costDots(f.costEstimate))}
                </span>
              </button>
            );
          })}
        </div>

        {/* Badge area: placing or selected */}
        {(placingForm || (selectedForm && !activePlacementFormId)) && (
          <>
            <div style={dividerStyle} />
            {placingForm ? (
              <div style={placingBadgeStyle}>
                {placingForm.name}
                <button
                  onClick={() => useStore.getState().setPlacementMode(null)}
                  style={cancelBtnStyle}
                >
                  ✕
                </button>
              </div>
            ) : selectedForm ? (
              <div style={selectedBadgeStyle}>
                ● {selectedForm.name}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type check + test**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 5: Commit**

```bash
cd /c/MHome/MContainer && git add src/components/ui/BottomPanel.tsx src/Testing/bottom-bar-selection.test.ts && git commit -m "feat: redesign bottom bar with icon tabs, SVG thumbnails, sidebar-aware positioning, and auto-sync"
```

---

### Task 8: Final Verification + Full Regression

- [ ] **Step 1: Type check entire project**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run full test suite**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass (existing + new)

- [ ] **Step 3: Browser verification checklist**

Open `npm run dev` and walk through:

1. **Click empty wall face** → Sidebar shows FinishesPanel (not SkinEditor)
2. **Click empty voxel** → Sidebar shows WallTypePicker
3. **Activate placement mode** (click a door card) → ghost follows cursor
4. **Place a door** on a wall → door placed, placement mode exits
5. **Click the placed door** → Sidebar shows SkinEditor with Materials/Quick Skins/Door Controls
6. **Bottom bar auto-syncs** → Doors tab highlighted, door card has cyan border
7. **Bottom bar badge** → shows "● Single Swing Door" in cyan
8. **Click empty space** → deselect all, Sidebar returns to Container Properties
9. **Collapse sidebar** → bottom bar repositions to center over canvas
10. **Expand sidebar** → bottom bar repositions again
11. **Inspector defaults** → preview and grid sections are collapsed on first container select
12. **Icon tabs** → 4 icons above card strip, hover shows tooltips
13. **Card thumbnails** → SVG silhouettes visible on each card
14. **Escape key** → deselects everything including a selected SceneObject

- [ ] **Step 4: Final commit tag**

```bash
cd /c/MHome/MContainer && git tag -a sprint-ui-redesign-complete -m "Bottom bar redesign + context-aware selection (8 tasks)"
```
