# Sims-Style UI Overhaul — Plan A: Structural Overhaul

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the UI to separate wall types from finishes — sidebar becomes the primary workspace with contextual sections, bottom hotbar becomes a minimal recent-items strip.

**Architecture:** Add `FaceFinish` type and `faceFinishes` to `Voxel` (non-breaking parallel field). Restructure the sidebar Inspector to have collapsible Preview and Grid sections, with a contextual area below that shows Wall Type picker (voxel selected) or container properties (nothing selected). Replace SmartHotbar with RecentItemsBar. Plan B (follow-up) adds the Finishes panel, rendering, and fixtures.

**Tech Stack:** React 19, Zustand 5, TypeScript, Three.js (R3F)

**Spec:** `docs/superpowers/specs/2026-03-21-sims-style-ui-overhaul-design.md`

---

### Task 1: FaceFinish Type + Store Actions

**Files:**
- Modify: `src/types/container.ts:327` (add FaceFinish type after Voxel interface)
- Modify: `src/store/slices/voxelSlice.ts` (add setFaceFinish, clearFaceFinish actions)
- Create: `src/Testing/face-finish.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/Testing/face-finish.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';

function addTestContainer() {
  const s = useStore.getState();
  return s.addContainer('40ft_hc', { x: 0, y: 0, z: 0 });
}

describe('FaceFinish store actions', () => {
  beforeEach(() => useStore.getState().resetStore());

  it('setFaceFinish sets a finish on a voxel face', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { material: 'wood', paint: '#E8DDD0' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.material).toBe('wood');
    expect(v.faceFinishes?.n?.paint).toBe('#E8DDD0');
  });

  it('setFaceFinish merges with existing finish', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { material: 'wood' });
    useStore.getState().setFaceFinish(id, 9, 'n', { paint: '#FF0000' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.material).toBe('wood');
    expect(v.faceFinishes?.n?.paint).toBe('#FF0000');
  });

  it('clearFaceFinish removes finish for a face', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { material: 'wood' });
    useStore.getState().clearFaceFinish(id, 9, 'n');
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n).toBeUndefined();
  });

  it('faceFinishes is undefined by default (no migration needed)', () => {
    const id = addTestContainer();
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/face-finish.test.ts`
Expected: FAIL — `setFaceFinish` not found on store.

- [ ] **Step 3: Add FaceFinish type to container.ts**

In `src/types/container.ts`, after the `Voxel` interface (line 327), add:

```ts
/** Per-face finish overrides — absent values fall back to theme defaults */
export interface FaceFinish {
  material?: string;      // 'steel' | 'wood' | 'concrete' | 'bamboo' | etc.
  paint?: string;         // hex color for interior paint
  tint?: string;          // glass tint: 'clear' | 'smoke' | 'blue' | 'privacy'
  frameColor?: string;    // window/door frame hex color
  doorStyle?: string;     // 'swing' | 'sliding' | 'barn'
  light?: string;         // 'pendant' | 'flush' | 'track' | 'recessed' | 'none'
  lightColor?: string;    // 'warm' | 'cool' | 'daylight' | 'amber'
  electrical?: string;    // 'switch' | 'double_switch' | 'outlet' | 'dimmer' | 'none'
}

export type FaceFinishes = Partial<Record<keyof VoxelFaces, FaceFinish>>;
```

Then add `faceFinishes?` to the `Voxel` interface (after `roomTag` at line 312):

```ts
  /** Per-face finish overrides — absent = use theme defaults.
   *  Parallel to `faces` (structural type). Does NOT affect merge detection or BOM. */
  faceFinishes?: FaceFinishes;
```

- [ ] **Step 4: Add store actions to voxelSlice.ts**

In `src/store/slices/voxelSlice.ts`, add to the VoxelSlice interface:

```ts
setFaceFinish: (containerId: string, voxelIndex: number, face: keyof VoxelFaces, finish: Partial<FaceFinish>) => void;
clearFaceFinish: (containerId: string, voxelIndex: number, face: keyof VoxelFaces) => void;
```

Add implementations (near the other face-modifying actions):

```ts
setFaceFinish: (containerId, voxelIndex, face, finish) => set((s) => {
  const v = s.containers[containerId]?.voxelGrid?.[voxelIndex];
  if (!v) return;
  if (!v.faceFinishes) v.faceFinishes = {};
  v.faceFinishes[face] = { ...v.faceFinishes[face], ...finish };
}),

clearFaceFinish: (containerId, voxelIndex, face) => set((s) => {
  const v = s.containers[containerId]?.voxelGrid?.[voxelIndex];
  if (!v?.faceFinishes) return;
  delete v.faceFinishes[face];
  if (Object.keys(v.faceFinishes).length === 0) {
    delete v.faceFinishes;
  }
}),
```

Import `FaceFinish` from `../../types/container` at the top of voxelSlice.ts.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/face-finish.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 6: Run full suite + TypeScript check**

Run: `cd /c/MHome/MContainer && npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/container.ts src/store/slices/voxelSlice.ts src/Testing/face-finish.test.ts
git commit -m "feat: add FaceFinish type and setFaceFinish/clearFaceFinish store actions"
```

---

### Task 2: Recent Items Store + UI State

**Files:**
- Modify: `src/store/slices/uiSlice.ts` (add recentItems, previewCollapsed, gridCollapsed)
- Create: `src/Testing/recent-items.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/Testing/recent-items.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';

describe('recentItems', () => {
  beforeEach(() => useStore.getState().resetStore());

  it('starts empty', () => {
    expect(useStore.getState().recentItems).toEqual([]);
  });

  it('addRecentItem adds to front', () => {
    useStore.getState().addRecentItem({ type: 'wallType', value: 'Solid_Steel', label: 'Solid Wall' });
    expect(useStore.getState().recentItems[0].value).toBe('Solid_Steel');
  });

  it('addRecentItem dedupes (moves existing to front)', () => {
    const s = useStore.getState;
    s().addRecentItem({ type: 'wallType', value: 'Solid_Steel', label: 'Solid Wall' });
    s().addRecentItem({ type: 'wallType', value: 'Glass_Pane', label: 'Glass' });
    s().addRecentItem({ type: 'wallType', value: 'Solid_Steel', label: 'Solid Wall' });
    expect(s().recentItems.length).toBe(2);
    expect(s().recentItems[0].value).toBe('Solid_Steel');
  });

  it('caps at 8 items', () => {
    for (let i = 0; i < 12; i++) {
      useStore.getState().addRecentItem({ type: 'wallType', value: `item_${i}`, label: `Item ${i}` });
    }
    expect(useStore.getState().recentItems.length).toBe(8);
  });
});

describe('collapsible state', () => {
  beforeEach(() => useStore.getState().resetStore());

  it('previewCollapsed defaults to false', () => {
    expect(useStore.getState().previewCollapsed).toBe(false);
  });

  it('gridCollapsed defaults to false', () => {
    expect(useStore.getState().gridCollapsed).toBe(false);
  });

  it('setPreviewCollapsed toggles', () => {
    useStore.getState().setPreviewCollapsed(true);
    expect(useStore.getState().previewCollapsed).toBe(true);
  });

  it('setGridCollapsed toggles', () => {
    useStore.getState().setGridCollapsed(true);
    expect(useStore.getState().gridCollapsed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/recent-items.test.ts`
Expected: FAIL — properties not found on store.

- [ ] **Step 3: Add state and actions to uiSlice.ts**

In `src/store/slices/uiSlice.ts`, add to the UiSlice interface:

```ts
// Recent items strip (replaces hotbar)
recentItems: RecentItem[];
addRecentItem: (item: RecentItem) => void;

// Collapsible sidebar sections
previewCollapsed: boolean;
setPreviewCollapsed: (v: boolean) => void;
gridCollapsed: boolean;
setGridCollapsed: (v: boolean) => void;
```

Add the `RecentItem` type at the top of the file:

```ts
export interface RecentItem {
  type: 'wallType' | 'finish';
  value: string;     // SurfaceType or finish identifier
  label: string;     // display label
  icon?: string;     // optional icon path
}
```

Add implementations:

```ts
recentItems: [],
addRecentItem: (item) => set((s) => {
  const filtered = s.recentItems.filter(r => r.value !== item.value);
  s.recentItems = [item, ...filtered].slice(0, 8);
}),

previewCollapsed: false,
setPreviewCollapsed: (v) => set({ previewCollapsed: v }),
gridCollapsed: false,
setGridCollapsed: (v) => set({ gridCollapsed: v }),
```

Mark `recentItems`, `previewCollapsed`, `gridCollapsed` as ephemeral (exclude from persist) in the partialize config in `src/store/useStore.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/recent-items.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 5: Run full suite + TypeScript check**

Run: `cd /c/MHome/MContainer && npx vitest run && npx tsc --noEmit`
Expected: All tests pass, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/store/slices/uiSlice.ts src/store/useStore.ts src/Testing/recent-items.test.ts
git commit -m "feat: add recentItems MRU list and collapsible sidebar state"
```

---

### Task 3: Wall Type Picker Component

**Files:**
- Create: `src/components/ui/WallTypePicker.tsx`
- Create: `src/config/wallTypes.ts` (wall type definitions with icons)

- [ ] **Step 1: Create wall type definitions**

```ts
// src/config/wallTypes.ts
import type { SurfaceType, VoxelFaces } from '../types/container';

export interface WallTypeEntry {
  surface: SurfaceType;
  label: string;
  icon: string;         // SVG path or emoji placeholder
  category: 'wall' | 'floor' | 'ceiling';
  description?: string;
}

export const WALL_TYPES: WallTypeEntry[] = [
  { surface: 'Solid_Steel', label: 'Solid Wall', icon: '🔲', category: 'wall' },
  { surface: 'Glass_Pane', label: 'Glass Pane', icon: '🪟', category: 'wall' },
  { surface: 'Window_Standard', label: 'Window', icon: '⬜', category: 'wall' },
  { surface: 'Window_Half', label: 'Half Window', icon: '▭', category: 'wall' },
  { surface: 'Window_Sill', label: 'Sill Window', icon: '▤', category: 'wall' },
  { surface: 'Window_Clerestory', label: 'Clerestory', icon: '═', category: 'wall' },
  { surface: 'Door', label: 'Door', icon: '🚪', category: 'wall' },
  { surface: 'Railing_Cable', label: 'Cable Rail', icon: '⫿', category: 'wall' },
  { surface: 'Railing_Glass', label: 'Glass Rail', icon: '▯', category: 'wall' },
  { surface: 'Open', label: 'Open', icon: '▫️', category: 'wall' },
  { surface: 'Glass_Shoji', label: 'Shoji', icon: '▦', category: 'wall' },
  { surface: 'Wall_Washi', label: 'Washi Panel', icon: '▧', category: 'wall' },
  { surface: 'Half_Fold', label: 'Half Fold', icon: '⌐', category: 'wall' },
  { surface: 'Gull_Wing', label: 'Gull Wing', icon: '⌃', category: 'wall' },
  // Floor types
  { surface: 'Deck_Wood', label: 'Deck Wood', icon: '🪵', category: 'floor' },
  { surface: 'Concrete', label: 'Concrete', icon: '⬛', category: 'floor' },
  { surface: 'Wood_Hinoki', label: 'Hinoki', icon: '🟫', category: 'floor' },
  { surface: 'Floor_Tatami', label: 'Tatami', icon: '🟩', category: 'floor' },
  { surface: 'Open', label: 'Open', icon: '▫️', category: 'floor' },
  // Ceiling types
  { surface: 'Solid_Steel', label: 'Steel', icon: '⬛', category: 'ceiling' },
  { surface: 'Open', label: 'Open', icon: '▫️', category: 'ceiling' },
];

export function getWallTypesForContext(inspectorView: 'floor' | 'ceiling', selectedFace: string | null): WallTypeEntry[] {
  if (selectedFace === 'top' || inspectorView === 'ceiling') {
    return WALL_TYPES.filter(t => t.category === 'ceiling');
  }
  if (selectedFace === 'bottom') {
    return WALL_TYPES.filter(t => t.category === 'floor');
  }
  return WALL_TYPES.filter(t => t.category === 'wall');
}
```

- [ ] **Step 2: Create WallTypePicker component**

```tsx
// src/components/ui/WallTypePicker.tsx
"use client";

import { useStore } from "@/store/useStore";
import { getWallTypesForContext, type WallTypeEntry } from "@/config/wallTypes";

export default function WallTypePicker({ containerId, voxelIndex }: { containerId: string; voxelIndex: number }) {
  const inspectorView = useStore((s) => s.inspectorView);
  const selectedFace = useStore((s) => s.selectedFace);
  const paintFace = useStore((s) => s.paintFace);
  const setVoxelAllFaces = useStore((s) => s.setVoxelAllFaces);
  const addRecentItem = useStore((s) => s.addRecentItem);

  const types = getWallTypesForContext(inspectorView, selectedFace);

  const handleClick = (entry: WallTypeEntry) => {
    if (selectedFace) {
      // Apply to specific face
      paintFace(containerId, voxelIndex, selectedFace, entry.surface);
    } else {
      // Apply to all wall faces (like a preset)
      // Only walls — don't overwrite floor/ceiling
      const s = useStore.getState();
      const voxel = s.containers[containerId]?.voxelGrid?.[voxelIndex];
      if (!voxel) return;
      for (const face of ['n', 's', 'e', 'w'] as const) {
        paintFace(containerId, voxelIndex, face, entry.surface);
      }
    }
    addRecentItem({ type: 'wallType', value: entry.surface, label: entry.label });
  };

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {selectedFace ? `${selectedFace.toUpperCase()} Face Type` : 'Wall Types'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {types.map((entry) => (
          <button
            key={entry.surface + entry.category}
            onClick={() => handleClick(entry)}
            title={entry.description ?? entry.label}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 4px', borderRadius: 6,
              border: '1px solid #334155', background: '#1e293b',
              color: '#e2e8f0', cursor: 'pointer', fontSize: 10,
              transition: 'border-color 100ms',
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = '#3b82f6')}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = '#334155')}
          >
            <span style={{ fontSize: 20 }}>{entry.icon}</span>
            <span>{entry.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/config/wallTypes.ts src/components/ui/WallTypePicker.tsx
git commit -m "feat: add WallTypePicker icon grid component"
```

---

### Task 4: RecentItemsBar Component

**Files:**
- Create: `src/components/ui/RecentItemsBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/ui/RecentItemsBar.tsx
"use client";

import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";

export default function RecentItemsBar() {
  const recentItems = useStore(useShallow((s) => s.recentItems));
  const paintFace = useStore((s) => s.paintFace);
  const selectedVoxel = useStore((s) => s.selectedVoxel);
  const selectedFace = useStore((s) => s.selectedFace);

  const applyRecent = (index: number) => {
    const item = recentItems[index];
    if (!item || !selectedVoxel) return;

    const containerId = selectedVoxel.containerId;
    const voxelIndex = 'index' in selectedVoxel ? selectedVoxel.index : 0;

    if (item.type === 'wallType' && selectedFace) {
      paintFace(containerId, voxelIndex, selectedFace, item.value as any);
    }
  };

  // Keyboard shortcuts 1-9 handled by useAppHotkeys (will be wired in Task 6)

  if (recentItems.length === 0) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', height: 40,
      background: 'rgba(15, 23, 42, 0.9)',
      borderTop: '1px solid #1e293b',
    }}>
      <span style={{ fontSize: 10, color: '#64748b', marginRight: 4 }}>Recent:</span>
      {recentItems.map((item, i) => (
        <button
          key={item.value}
          onClick={() => applyRecent(i)}
          title={`${i + 1}: ${item.label}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 4,
            border: '1px solid #334155', background: '#1e293b',
            color: '#cbd5e1', cursor: 'pointer', fontSize: 10,
          }}
        >
          <span style={{ fontSize: 9, color: '#64748b' }}>{i + 1}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/RecentItemsBar.tsx
git commit -m "feat: add RecentItemsBar component for bottom quick-access strip"
```

---

### Task 5: Sidebar Restructure — Collapsible Sections + Contextual Area

**Files:**
- Modify: `src/components/ui/Sidebar.tsx` (restructure Inspector function)

This is the largest task. Read `src/components/ui/Sidebar.tsx` fully before making changes.

- [ ] **Step 1: Read Sidebar.tsx completely**

Read lines 326-510 (Inspector function) to understand the current layout. Note where Container Info, IsoEditor, MatrixEditor are rendered.

- [ ] **Step 2: Add collapsible wrappers**

Wrap the IsoEditor (preview) section with a collapsible container:

```tsx
const previewCollapsed = useStore((s) => s.previewCollapsed);
const setPreviewCollapsed = useStore((s) => s.setPreviewCollapsed);
const gridCollapsed = useStore((s) => s.gridCollapsed);
const setGridCollapsed = useStore((s) => s.setGridCollapsed);
```

Replace the current Inspector layout with:

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
    {/* Preview section — collapsible */}
    <div>
      <div onClick={() => setPreviewCollapsed(!previewCollapsed)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
        <span>{previewCollapsed ? '▶' : '▼'}</span> Preview
      </div>
      {!previewCollapsed && (
        <div style={{ padding: '0 12px' }}>
          {/* Container name overlay on preview */}
          <div style={{ position: 'relative' }}>
            <IsoEditor containerId={containerId} />
            <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, color: '#e2e8f0', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
              {container.name || container.type}
            </div>
          </div>
        </div>
      )}
      {/* Always visible: Hide Roof, Hide Skin, Save, Synced */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', fontSize: 11 }}>
        {/* Keep existing Hide Roof, Hide Skin, bookmark, Synced badge buttons */}
        {/* Move these OUT of the collapsible section */}
      </div>
    </div>

    {/* Grid section — collapsible */}
    <div>
      <div onClick={() => setGridCollapsed(!gridCollapsed)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
        <span>{gridCollapsed ? '▶' : '▼'}</span> Container Grid
      </div>
      {!gridCollapsed && (
        <div style={{ padding: '0 12px' }}>
          {frameMode ? <FrameInspector ... /> : <MatrixEditor ... />}
        </div>
      )}
    </div>

    {/* Contextual area — fills remaining space, scrollable */}
    <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #1e293b' }}>
      <ContextualPanel containerId={containerId} container={container} />
    </div>
  </div>
);
```

- [ ] **Step 3: Create ContextualPanel routing component**

Add within Sidebar.tsx (or as a separate component):

```tsx
import WallTypePicker from './WallTypePicker';
import { useSelectionTarget } from '@/hooks/useSelectionTarget';

function ContextualPanel({ containerId, container }: { containerId: string; container: Container }) {
  const target = useSelectionTarget();

  // Voxel selected → Wall Type picker
  if (target.type === 'voxel' || target.type === 'bay') {
    return <WallTypePicker containerId={containerId} voxelIndex={target.type === 'voxel' ? target.index : target.indices[0]} />;
  }

  // Face selected → Finishes panel (Plan B — stub for now)
  if (target.type === 'face' || target.type === 'bay-face') {
    return (
      <div style={{ padding: '12px', color: '#94a3b8', fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Finishes</div>
        <p>Wall finish options coming in Plan B.</p>
        <p>Selected face: {target.type === 'face' ? target.face : target.face}</p>
      </div>
    );
  }

  // Nothing selected → Container properties
  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Move Finish dropdown and Rooftop Deck here */}
      {/* These were previously in the fixed Container Info area */}
      <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>
        Container Properties
      </div>
      {/* Existing Finish dropdown */}
      {/* Existing Rooftop Deck button */}
    </div>
  );
}
```

- [ ] **Step 4: Move Container Info fields to ContextualPanel**

Find the "Finish:" dropdown and "Rooftop Deck:" button in the Inspector function (around lines 420-493). Move them into the ContextualPanel's "nothing selected" branch. Keep the same component code, just relocate it.

- [ ] **Step 5: Update the sidebar header**

Replace the "Container 40ft HC" info card with a simpler header showing just the name in the Library/Inspector toggle area:

```tsx
{/* In the header bar */}
<span style={{ fontWeight: 600, fontSize: 13 }}>
  {container.name || 'Container ' + container.type}
</span>
```

- [ ] **Step 6: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Run all tests**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/Sidebar.tsx
git commit -m "feat: restructure sidebar with collapsible Preview/Grid and contextual area"
```

---

### Task 6: Replace SmartHotbar with RecentItemsBar

**Files:**
- Modify: `src/components/ui/BottomDock.tsx` or parent layout (wherever SmartHotbar is mounted)
- Modify: `src/components/ui/SmartHotbar.tsx` (comment out, not delete — Plan B may reference)

- [ ] **Step 1: Find where SmartHotbar is mounted**

Search for `<SmartHotbar` in the codebase to find the parent component. Read the layout to understand how to swap it.

Run: `grep -rn "SmartHotbar" src/components/ --include="*.tsx" | grep -v "import" | head -10`

- [ ] **Step 2: Replace SmartHotbar mount with RecentItemsBar**

In the parent component, replace:
```tsx
<SmartHotbar />
```
with:
```tsx
<RecentItemsBar />
```

Update imports accordingly. Do NOT delete SmartHotbar.tsx — comment out the mount only. Plan B's Finishes panel may still reference some of its data structures.

- [ ] **Step 3: Remove hotbar-specific keyboard shortcuts**

In `src/hooks/useAppHotkeys.ts` (or wherever hotbar tab cycling is handled), disable Tab/±/number-key hotbar shortcuts. Replace number keys 1-9 with recent-items application:

The existing number key handler likely calls `setActiveHotbarSlot`. Update it to call `applyRecent(index)` from the recent items list instead.

- [ ] **Step 4: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors (SmartHotbar still compiles, just not mounted).

- [ ] **Step 5: Run all tests**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass. Some tests may reference SmartHotbar — update imports if needed.

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "feat: replace SmartHotbar with RecentItemsBar in bottom dock"
```

---

### Task 7: Integration Verification

**Files:** No new files — verification only.

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run full test suite**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Start dev server and verify in browser**

Start: `npm run dev`

Verify:
- [ ] Sidebar shows collapsible Preview with container name overlay
- [ ] Preview collapse hides 3D view but keeps Hide Roof/Skin/Save visible
- [ ] Sidebar shows collapsible Container Grid
- [ ] Selecting a voxel shows Wall Type icon grid in contextual area
- [ ] Clicking a wall type applies it to the selected voxel's wall faces
- [ ] Selecting a face shows "Finishes coming in Plan B" stub
- [ ] Nothing selected shows container properties (Finish, Rooftop Deck)
- [ ] Bottom bar shows recent items strip (populates as you apply wall types)
- [ ] Old SmartHotbar tabs are gone
- [ ] BOM bar still visible

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix: integration fixes for Sims-style UI Plan A"
```

---

## Summary

| Task | Description | New Files | Modified Files |
|------|-------------|-----------|---------------|
| 1 | FaceFinish type + store actions | 1 test | 2 (container.ts, voxelSlice.ts) |
| 2 | Recent items + collapsible state | 1 test | 2 (uiSlice.ts, useStore.ts) |
| 3 | WallTypePicker component | 2 (wallTypes.ts, WallTypePicker.tsx) | 0 |
| 4 | RecentItemsBar component | 1 (RecentItemsBar.tsx) | 0 |
| 5 | Sidebar restructure | 0 | 1 (Sidebar.tsx) |
| 6 | Replace SmartHotbar | 0 | 2-3 (layout, hotkeys) |
| 7 | Integration verification | 0 | 0 |

**Total new files:** 5
**Total modified files:** 5-7
**Plan B (follow-up):** Finishes panel, rendering, color picker, light fixtures, electrical plates
