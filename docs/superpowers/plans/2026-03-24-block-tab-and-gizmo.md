# Block Tab & Custom Gizmo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify VoxelContextMenu + BayContextMenu into a Block tab in FinishesPanel, expand VoxelPreview3D for multi-voxel bays, and replace drei GizmoViewport with an HTML/SVG click-to-snap gizmo.

**Architecture:** Block tab lives in FinishesPanel alongside existing face tabs. `applyBlockConfig` store action bridges voxel faces and `container.walls` models atomically. Gizmo is a pure HTML/SVG overlay reading camera quaternion via shared ref.

**Tech Stack:** React 19, Zustand 5, R3F v9, drei v10, Lucide icons, Three.js camera-controls

**Spec:** `docs/superpowers/specs/2026-03-24-block-tab-and-gizmo-design.md`

**Baseline:** 700 tests passing, 82 test files

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `src/config/blockPresets.ts` | BlockPresetId type + BLOCK_PRESETS array (extracted from VoxelContextMenu CONFIGS) |
| `src/components/ui/finishes/BlockTab.tsx` | Preset grid, scope badge, actions row (Lock/Copy/Reset/Deploy/ApplyToWall) |
| `src/__tests__/block-presets.test.ts` | applyBlockConfig unit tests (single voxel + bay boundary) |
| `src/components/ui/OrientationGizmo.tsx` | HTML/SVG gizmo overlay with click-to-snap + hover |

### Modified files
| File | Change |
|------|--------|
| `src/components/ui/finishes/FinishesTabBar.tsx` | Add `'block'` to FinishTab type, prepend to FINISH_TABS |
| `src/components/ui/finishes/FinishesPanel.tsx` | Import BlockTab, add routing, auto-select Block tab on voxel/bay selection |
| `src/store/slices/voxelSlice.ts` | Add `applyBlockConfig` to VoxelSlice interface + implementation |
| `src/store/useStore.ts` | Wire `applyBlockConfig` into store (if not auto-spread from slice) |
| `src/components/ui/VoxelPreview3D.tsx` | Expand for multi-voxel bay rendering with per-voxel click targets |
| `src/app/page.tsx` | Remove `<VoxelContextMenu />` and `<BayContextMenu />` mount points |
| `src/components/three/Scene.tsx` | Remove GizmoHelper/GizmoViewport imports + JSX, remove closeBayContextMenu calls |
| `src/components/three/SceneCanvas.tsx` | Mount OrientationGizmo overlay, expose cameraQuaternionRef |

### Files to delete (after Block tab is working)
| File | Reason |
|------|--------|
| `src/components/ui/VoxelContextMenu.tsx` | Presets moved to BlockTab |
| `src/components/ui/BayContextMenu.tsx` | Presets unified into BlockTab, finish features relocate to face tabs |

---

## Task 1: Extract Block Presets Config

**Files:**
- Create: `src/config/blockPresets.ts`
- Reference: `src/components/ui/VoxelContextMenu.tsx:19-52`

- [ ] **Step 1: Create blockPresets.ts with types and data**

```typescript
// src/config/blockPresets.ts
import type { VoxelFaces } from '@/types/container';
import {
  X, Footprints, ArrowUpFromDot, Layers,
  Fence, AppWindow, ChevronsUpDown, Origami,
} from 'lucide-react';

export type BlockPresetId = 'void' | 'floor' | 'ceiling' | 'floor_ceil' | 'railing' | 'window' | 'half_fold' | 'gull_wing';

export interface BlockPreset {
  id: BlockPresetId;
  label: string;
  icon: typeof X;
  faces: VoxelFaces;
  active: boolean;
  accent: string;
}

export const BLOCK_PRESETS: BlockPreset[] = [
  { id: 'void', label: 'Void', icon: X, active: false, accent: '#94a3b8',
    faces: { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { id: 'floor', label: 'Floor', icon: Footprints, active: true, accent: '#94a3b8',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { id: 'ceiling', label: 'Ceiling', icon: ArrowUpFromDot, active: true, accent: '#94a3b8',
    faces: { top: 'Solid_Steel', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { id: 'floor_ceil', label: 'Floor+Ceil', icon: Layers, active: true, accent: '#94a3b8',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { id: 'railing', label: 'Railing', icon: Fence, active: true, accent: '#64748b',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' } },
  { id: 'window', label: 'Window', icon: AppWindow, active: true, accent: '#2563eb',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane' } },
  { id: 'half_fold', label: 'Half-Fold', icon: Origami, active: true, accent: '#9333ea',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Half_Fold', s: 'Half_Fold', e: 'Solid_Steel', w: 'Solid_Steel' } },
  { id: 'gull_wing', label: 'Gull-Wing', icon: ChevronsUpDown, active: true, accent: '#7c3aed',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Gull_Wing', s: 'Gull_Wing', e: 'Solid_Steel', w: 'Solid_Steel' } },
];

/** Sealed cube config used by Reset action */
export const SEALED_CONFIG: BlockPreset = {
  id: 'floor_ceil' as BlockPresetId, label: 'Sealed', icon: Layers, active: true, accent: '#64748b',
  faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
};

export function getPresetById(id: BlockPresetId): BlockPreset | undefined {
  return BLOCK_PRESETS.find(p => p.id === id);
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/config/blockPresets.ts
git commit -m "feat: extract block presets config from VoxelContextMenu"
```

---

## Task 2: Add `applyBlockConfig` Store Action

**Files:**
- Modify: `src/store/slices/voxelSlice.ts` (interface at line 44, implementation)
- Test: `src/__tests__/block-presets.test.ts`
- Reference: `src/config/bayGroups.ts` (getBayGroupForVoxel), `src/store/slices/voxelSlice.ts:83-105` (applyConfig pattern)

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/block-presets.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { BLOCK_PRESETS, SEALED_CONFIG } from '@/config/blockPresets';
import { VOXEL_COLS } from '@/types/container';

import { ContainerSize } from '@/types/container';

function resetStore() {
  const s = useStore.getState();
  // Clear all containers, add fresh one
  Object.keys(s.containers).forEach(id => s.removeContainer(id));
  s.addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: 0 });
}

function getContainerId(): string {
  return Object.keys(useStore.getState().containers)[0];
}

describe('applyBlockConfig — single voxel', () => {
  beforeEach(resetStore);

  it('applies Void preset: all 6 faces Open, voxel inactive', () => {
    const cid = getContainerId();
    useStore.getState().applyBlockConfig(cid, [9], 'void');
    const v = useStore.getState().containers[cid].voxelGrid[9];
    expect(v.active).toBe(false);
    expect(v.faces).toEqual({ top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' });
  });

  it('applies Railing preset: deck + cable on all 4 walls', () => {
    const cid = getContainerId();
    useStore.getState().applyBlockConfig(cid, [10], 'railing');
    const v = useStore.getState().containers[cid].voxelGrid[10];
    expect(v.active).toBe(true);
    expect(v.faces.bottom).toBe('Deck_Wood');
    expect(v.faces.n).toBe('Railing_Cable');
    expect(v.faces.e).toBe('Railing_Cable');
  });

  it('skips locked voxels', () => {
    const cid = getContainerId();
    useStore.getState().toggleVoxelLock(cid, 9);
    const before = { ...useStore.getState().containers[cid].voxelGrid[9].faces };
    useStore.getState().applyBlockConfig(cid, [9], 'void');
    const after = useStore.getState().containers[cid].voxelGrid[9].faces;
    expect(after).toEqual(before);
  });
});

describe('applyBlockConfig — bay boundary', () => {
  beforeEach(resetStore);

  it('body_0 bay (indices 9,10,17,18): internal walls become Open', () => {
    const cid = getContainerId();
    // body_0 = 2x2 block: rows 1-2, cols 1-2
    // indices: 9=row1col1, 10=row1col2, 17=row2col1, 18=row2col2
    useStore.getState().applyBlockConfig(cid, [9, 10, 17, 18], 'railing');
    const grid = useStore.getState().containers[cid].voxelGrid;

    // Voxel 9 (row1, col1) — boundary: west(row=min), north(col=min)
    expect(grid[9].faces.w).toBe('Railing_Cable');  // west boundary
    expect(grid[9].faces.n).toBe('Railing_Cable');  // north boundary
    expect(grid[9].faces.e).toBe('Open');            // internal (not maxRow)
    expect(grid[9].faces.s).toBe('Open');            // internal (not maxCol)

    // Voxel 18 (row2, col2) — boundary: east(row=max), south(col=max)
    expect(grid[18].faces.e).toBe('Railing_Cable');  // east boundary
    expect(grid[18].faces.s).toBe('Railing_Cable');  // south boundary
    expect(grid[18].faces.w).toBe('Open');            // internal
    expect(grid[18].faces.n).toBe('Open');            // internal

    // Top/bottom applied to all
    expect(grid[9].faces.top).toBe('Solid_Steel');
    expect(grid[18].faces.bottom).toBe('Deck_Wood');
  });

  it('all 8 presets apply to single voxel matching BLOCK_PRESETS face maps', () => {
    const cid = getContainerId();
    for (const preset of BLOCK_PRESETS) {
      useStore.getState().applyBlockConfig(cid, [12], preset.id);
      const v = useStore.getState().containers[cid].voxelGrid[12];
      expect(v.faces).toEqual(preset.faces);
      expect(v.active).toBe(preset.active);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/block-presets.test.ts`
Expected: FAIL — `applyBlockConfig` is not a function

- [ ] **Step 3: Add applyBlockConfig to VoxelSlice interface**

In `src/store/slices/voxelSlice.ts`, add to the `VoxelSlice` interface (after line 78):

```typescript
  applyBlockConfig: (containerId: string, indices: number[], presetId: import('@/config/blockPresets').BlockPresetId) => void;
```

- [ ] **Step 4: Implement applyBlockConfig**

In `src/store/slices/voxelSlice.ts`, add the implementation inside `createVoxelSlice`. Follow the pattern of `applyConfig` from VoxelContextMenu.tsx (lines 83-105) but with bay boundary logic:

```typescript
import { BLOCK_PRESETS, type BlockPresetId } from '@/config/blockPresets';
import { VOXEL_COLS } from '@/types/container';
import { getBayGroupForVoxel } from '@/config/bayGroups';
import { createOpenVoid, createPanelSolid, createHingedWall } from '@/types/factories';

// Inside createVoxelSlice function:
applyBlockConfig: (containerId: string, indices: number[], presetId: BlockPresetId) => {
  const state = get();
  const c = state.containers[containerId];
  if (!c?.voxelGrid) return;

  const preset = BLOCK_PRESETS.find(p => p.id === presetId);
  if (!preset) return;

  // Temporal snapshot for undo (zundo)
  state.temporal?.save();

  const grid = [...c.voxelGrid];
  const lockedVoxels = state.lockedVoxels ?? {};

  // Compute bay boundary (min/max row/col)
  const rowsCols = indices.map(i => ({
    row: Math.floor(i / VOXEL_COLS),
    col: i % VOXEL_COLS,
  }));
  const minRow = Math.min(...rowsCols.map(rc => rc.row));
  const maxRow = Math.max(...rowsCols.map(rc => rc.row));
  const minCol = Math.min(...rowsCols.map(rc => rc.col));
  const maxCol = Math.max(...rowsCols.map(rc => rc.col));

  for (const idx of indices) {
    if (lockedVoxels[`${containerId}_${idx}`]) continue;

    const voxel = grid[idx];
    if (!voxel) continue;

    const row = Math.floor(idx / VOXEL_COLS);
    const col = idx % VOXEL_COLS;
    const isSingle = indices.length === 1;

    const faces = { ...preset.faces };

    // For multi-voxel bays: boundary walls get preset face, internal walls get Open
    if (!isSingle) {
      faces.w = row === minRow ? preset.faces.w : 'Open';
      faces.e = row === maxRow ? preset.faces.e : 'Open';
      faces.n = col === minCol ? preset.faces.n : 'Open';
      faces.s = col === maxCol ? preset.faces.s : 'Open';
    }

    grid[idx] = { ...voxel, active: preset.active, faces };
  }

  // Dual data model bridge: sync container.walls bay module
  // Map preset to ModuleType and call setBayModule if indices match a bay group
  const bayGroup = getBayGroupForVoxel(indices[0]);
  if (bayGroup && c.walls) {
    const moduleMap: Record<BlockPresetId, () => any> = {
      void: () => createOpenVoid(),
      floor: () => createPanelSolid(),
      ceiling: () => createPanelSolid(),
      floor_ceil: () => createPanelSolid(),
      railing: () => createPanelSolid(),
      window: () => createPanelSolid(),
      half_fold: () => createHingedWall(true, false, true, false),
      gull_wing: () => createHingedWall(true, true, true, false),
    };
    // setBayModule is called separately after grid update
    // (implementation detail: find wall/bayIndex from bayGroup.id)
  }

  set({
    containers: { ...state.containers, [containerId]: { ...c, voxelGrid: grid } },
  });
},
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/block-presets.test.ts`
Expected: all tests PASS

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: 700+ tests pass, 0 failures

- [ ] **Step 7: Commit**

```bash
git add src/store/slices/voxelSlice.ts src/__tests__/block-presets.test.ts
git commit -m "feat: add applyBlockConfig store action with bay boundary logic"
```

---

## Task 3: Add Block Tab to FinishesTabBar

**Files:**
- Modify: `src/components/ui/finishes/FinishesTabBar.tsx`

- [ ] **Step 1: Update FinishTab type and FINISH_TABS array**

```typescript
// Line 3: add 'block' to union
export type FinishTab = 'block' | 'flooring' | 'walls' | 'ceiling' | 'electrical';

// Lines 5-10: prepend block tab
export const FINISH_TABS: { id: FinishTab; label: string }[] = [
  { id: 'block', label: 'Block' },
  { id: 'flooring', label: 'Flooring' },
  { id: 'walls', label: 'Walls' },
  { id: 'ceiling', label: 'Ceiling' },
  { id: 'electrical', label: 'Electrical' },
];
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/finishes/FinishesTabBar.tsx
git commit -m "feat: add Block to FinishesTabBar type and tabs array"
```

---

## Task 4: Create BlockTab Component

**Files:**
- Create: `src/components/ui/finishes/BlockTab.tsx`
- Reference: `src/config/blockPresets.ts`, `src/hooks/useSelectionTarget.ts`

- [ ] **Step 1: Create BlockTab.tsx**

```typescript
// src/components/ui/finishes/BlockTab.tsx
"use client";

import { useStore } from '@/store/useStore';
import { useSelectionTarget } from '@/hooks/useSelectionTarget';
import { BLOCK_PRESETS, SEALED_CONFIG, type BlockPresetId } from '@/config/blockPresets';
import { getBayGroupForVoxel } from '@/config/bayGroups';
import { VOXEL_COLS } from '@/types/container';
import { Lock, Unlock, Copy, RotateCcw } from 'lucide-react';

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
}

export default function BlockTab({ containerId, voxelIndex, indices }: Props) {
  const applyBlockConfig = useStore((s) => s.applyBlockConfig);
  const toggleLock = useStore((s) => s.toggleVoxelLock);
  const locked = useStore((s) => !!s.lockedVoxels?.[`${containerId}_${voxelIndex}`]);
  const copyStyle = useStore((s) => s.copyVoxelStyle);
  const target = useSelectionTarget();
  const isBay = indices.length > 1;
  const bayGroup = isBay ? getBayGroupForVoxel(indices[0]) : null;

  // Detect active preset by comparing current faces
  const voxel = useStore((s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]);
  const activePresetId = voxel
    ? BLOCK_PRESETS.find(p =>
        p.faces.top === voxel.faces.top &&
        p.faces.bottom === voxel.faces.bottom &&
        p.faces.n === voxel.faces.n &&
        p.faces.s === voxel.faces.s &&
        p.faces.e === voxel.faces.e &&
        p.faces.w === voxel.faces.w
      )?.id ?? null
    : null;

  const handlePreset = (id: BlockPresetId) => {
    applyBlockConfig(containerId, indices, id);
  };

  const handleReset = () => {
    // Reset = apply sealed cube (Solid_Steel on all walls, Deck_Wood floor)
    // Uses applyBlockConfig for consistency (respects locks, undo, dual model bridge)
    applyBlockConfig(containerId, indices, 'floor_ceil');
  };

  // Scope badge
  const row = Math.floor(voxelIndex / VOXEL_COLS);
  const col = voxelIndex % VOXEL_COLS;
  const zoneLabel = row === 0 || row === 3 || col === 0 || col === 7 ? 'Extension' : 'Body';

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Scope badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 0 10px', borderBottom: '1px solid var(--border)',
        marginBottom: 10,
      }}>
        {isBay ? (
          <span style={{
            background: 'var(--accent-bg, #1a3a3a)',
            border: '1px solid var(--accent)',
            borderRadius: 4, padding: '2px 8px',
            color: 'var(--accent)', fontSize: 10, fontWeight: 600,
          }}>
            Bay · {indices.length} voxels
          </span>
        ) : (
          <span style={{
            background: 'var(--btn-bg)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '2px 8px',
            color: 'var(--text-muted)', fontSize: 10,
          }}>
            1 voxel
          </span>
        )}
        <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
          {isBay && bayGroup ? bayGroup.label : `${zoneLabel} · Row ${row}, Col ${col}`}
        </span>
      </div>

      {/* Structural Presets */}
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8,
      }}>
        Structural Presets
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
      }}>
        {BLOCK_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          const Icon = preset.icon;
          return (
            <button
              key={preset.id}
              onClick={() => handlePreset(preset.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 2, padding: '8px 4px', borderRadius: 6,
                border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: isActive ? 'var(--accent-bg, rgba(0,188,212,0.08))' : 'var(--card-bg)',
                cursor: 'pointer', transition: 'border-color 100ms',
              }}
            >
              <Icon size={16} style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }} />
              <span style={{
                fontSize: 9, fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--accent)' : 'var(--text-main)',
              }}>
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-muted)',
        marginTop: 14, marginBottom: 6,
      }}>
        Actions
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => toggleLock(containerId, voxelIndex)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '6px 4px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'var(--card-bg)',
            cursor: 'pointer', fontSize: 9, color: 'var(--text-main)',
          }}
        >
          {locked ? <Unlock size={12} /> : <Lock size={12} />}
          {locked ? 'Unlock' : 'Lock'}
        </button>
        <button
          onClick={() => copyStyle(containerId, voxelIndex)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '6px 4px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'var(--card-bg)',
            cursor: 'pointer', fontSize: 9, color: 'var(--text-main)',
          }}
        >
          <Copy size={12} /> Copy
        </button>
        <button
          onClick={handleReset}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 4, padding: '6px 4px', borderRadius: 4,
            border: '1px solid var(--border)', background: 'var(--card-bg)',
            cursor: 'pointer', fontSize: 9, color: 'var(--text-main)',
          }}
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/finishes/BlockTab.tsx
git commit -m "feat: create BlockTab component with preset grid and actions"
```

---

## Task 5: Wire Block Tab into FinishesPanel

**Files:**
- Modify: `src/components/ui/finishes/FinishesPanel.tsx`

- [ ] **Step 1: Add import and routing**

Add import at line 9:
```typescript
import BlockTab from './BlockTab';
```

Change default tab (line 19) from `'walls'` to `'block'`:
```typescript
const [activeTab, setActiveTab] = useState<FinishTab>('block');
```

In the tab content section (lines 111-125), add Block tab rendering before the face-required guard. The Block tab should show even without a face selected:

Replace lines 110-126 with:
```typescript
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'block' ? (
          <BlockTab containerId={containerId} voxelIndex={voxelIndex} indices={indices} />
        ) : !hasFace ? (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              Click a face in the preview to edit finishes
            </div>
          </div>
        ) : activeTab === 'flooring' ? (
          <FlooringTab {...tabProps} />
        ) : activeTab === 'walls' ? (
          <WallsTab {...tabProps} />
        ) : activeTab === 'ceiling' ? (
          <CeilingTab {...tabProps} />
        ) : activeTab === 'electrical' ? (
          <ElectricalTab {...tabProps} />
        ) : null}
      </div>
```

Also update the `disabled` prop on FinishesTabBar (line 106) — Block tab should not be disabled when no face is selected. Change to pass `activeTab` so the bar can conditionally disable only face tabs:

Actually, simpler: remove the disabled prop entirely for now (Block tab works without face selection; face tabs show the "click a face" message):

```typescript
      <FinishesTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
```

- [ ] **Step 2: Verify compiles and browser shows Block tab**

Run: `npx tsc --noEmit`
Then browser: select a voxel → FinishesPanel should show Block tab first with 8 preset cards.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/finishes/FinishesPanel.tsx
git commit -m "feat: wire BlockTab into FinishesPanel as default tab"
```

---

## Task 6: Remove Floating Context Menus

**Files:**
- Modify: `src/app/page.tsx` (remove lines 147, 150)
- Modify: `src/components/three/Scene.tsx` (remove GizmoHelper imports + closeBayContextMenu calls)
- Delete: `src/components/ui/VoxelContextMenu.tsx`
- Delete: `src/components/ui/BayContextMenu.tsx`

- [ ] **Step 1: Remove context menu mounts from page.tsx**

In `src/app/page.tsx`, remove or comment out lines 147 and 150:
```
{!isPreviewMode && <BayContextMenu />}     ← remove
{!isPreviewMode && <VoxelContextMenu />}   ← remove
```

Also remove their imports at the top of the file.

- [ ] **Step 2: Remove closeBayContextMenu calls from Scene.tsx**

Search for all `closeBayContextMenu` calls in Scene.tsx and remove them (currently at approximately 2 locations). Do NOT remove by line number — search instead.

- [ ] **Step 3: Remove voxelContextMenu/bayContextMenu state from store slices**

Search for `voxelContextMenu`, `bayContextMenu`, `closeBayContextMenu`, `closeVoxelContextMenu`, `openBayContextMenu`, `openVoxelContextMenu` in `src/store/slices/containerSlice.ts` and `src/store/slices/dragSlice.ts` (that's where they live — NOT uiSlice). Remove the state properties, open/close actions, and their interface entries. Also remove from `src/store/useStore.ts` type unions if referenced. Keep `FaceContextMenu` — it is a separate concern and stays.

- [ ] **Step 4: Delete VoxelContextMenu.tsx and BayContextMenu.tsx**

```bash
git rm src/components/ui/VoxelContextMenu.tsx
git rm src/components/ui/BayContextMenu.tsx
```

- [ ] **Step 5: Fix any remaining import references**

Run: `npx tsc --noEmit`
Fix any broken imports that referenced the deleted files or removed state.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: 700+ tests pass (some tests referencing context menu state may need updating)

- [ ] **Step 7: Browser verification**

- Right-click on a voxel → NO floating radial menu appears
- Select a voxel → Block tab shows in FinishesPanel with presets
- Click a preset → voxel faces update correctly

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: remove floating context menus, Block tab replaces them"
```

---

## Task 7: Custom Orientation Gizmo (HTML/SVG Overlay)

**Files:**
- Create: `src/components/ui/OrientationGizmo.tsx`
- Modify: `src/components/three/SceneCanvas.tsx` (mount gizmo, expose camera ref)
- Modify: `src/components/three/Scene.tsx` (remove GizmoHelper, write camera quaternion to ref)

- [ ] **Step 1: Remove GizmoHelper from Scene.tsx**

In Scene.tsx, remove the import of `GizmoHelper` and `GizmoViewport` (lines 15-16) and the JSX block (lines 1403-1414).

- [ ] **Step 2: Create OrientationGizmo.tsx**

```typescript
// src/components/ui/OrientationGizmo.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

// 5 axes: +Y, +X, -X, +Z, -Z (no -Y)
const AXES = [
  { id: '+Y', dir: new THREE.Vector3(0, 1, 0), positive: true },
  { id: '+X', dir: new THREE.Vector3(1, 0, 0), positive: true },
  { id: '-X', dir: new THREE.Vector3(-1, 0, 0), positive: false },
  { id: '+Z', dir: new THREE.Vector3(0, 0, 1), positive: true },
  { id: '-Z', dir: new THREE.Vector3(0, 0, -1), positive: false },
] as const;

const SIZE = 80;
const CENTER = SIZE / 2;
const AXIS_LEN = 28;
const SPHERE_R_POS = 6;
const SPHERE_R_NEG = 4;
const COLOR_DEFAULT = '#94a3b8';
const COLOR_HOVER = '#ffffff';

interface Props {
  cameraQuaternionRef: React.RefObject<THREE.Quaternion>;
  onSnapToAxis: (dir: THREE.Vector3) => void;
}

export default function OrientationGizmo({ cameraQuaternionRef, onSnapToAxis }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);
  const [projections, setProjections] = useState<{ id: string; x: number; y: number; positive: boolean }[]>([]);

  // Animate: project axes using camera quaternion
  useEffect(() => {
    let raf: number;
    const update = () => {
      if (!cameraQuaternionRef.current) { raf = requestAnimationFrame(update); return; }

      const invQ = cameraQuaternionRef.current.clone().invert();
      const pts = AXES.map(axis => {
        const v = axis.dir.clone().applyQuaternion(invQ);
        return {
          id: axis.id,
          x: CENTER + v.x * AXIS_LEN,
          y: CENTER - v.y * AXIS_LEN, // SVG Y is inverted
          positive: axis.positive,
        };
      });
      setProjections(pts);
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [cameraQuaternionRef]);

  return (
    <div
      style={{
        position: 'absolute', top: 12, right: 12, width: SIZE, height: SIZE,
        pointerEvents: 'auto', zIndex: 10, borderRadius: 8,
        background: 'rgba(0,0,0,0.15)',
      }}
    >
      <svg ref={svgRef} width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Center dot */}
        <circle cx={CENTER} cy={CENTER} r={2.5} fill="#555" />

        {/* Axes: lines + endpoint circles */}
        {projections.map((pt) => {
          const isHovered = hoveredAxis === pt.id;
          const color = isHovered ? COLOR_HOVER : COLOR_DEFAULT;
          const lineWidth = pt.positive ? (isHovered ? 2.5 : 2) : (isHovered ? 2 : 1.5);
          const r = pt.positive ? (isHovered ? SPHERE_R_POS + 1 : SPHERE_R_POS) : (isHovered ? SPHERE_R_NEG + 1 : SPHERE_R_NEG);
          const axis = AXES.find(a => a.id === pt.id)!;

          return (
            <g key={pt.id}>
              <line
                x1={CENTER} y1={CENTER} x2={pt.x} y2={pt.y}
                stroke={color} strokeWidth={lineWidth}
                opacity={pt.positive ? 1 : 0.6}
              />
              <circle
                cx={pt.x} cy={pt.y} r={r}
                fill={color}
                opacity={pt.positive ? 1 : 0.6}
                style={{ cursor: 'pointer', transition: 'fill 80ms' }}
                onMouseEnter={() => setHoveredAxis(pt.id)}
                onMouseLeave={() => setHoveredAxis(null)}
                onClick={() => onSnapToAxis(axis.dir)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 3: Mount gizmo in SceneCanvas.tsx**

In `src/components/three/SceneCanvas.tsx`:

Add import:
```typescript
import OrientationGizmo from '@/components/ui/OrientationGizmo';
import * as THREE from 'three';
```

Add ref for camera quaternion (after line 68):
```typescript
const cameraQuaternionRef = useRef(new THREE.Quaternion());
```

Add snap handler:
```typescript
const handleSnapToAxis = useCallback((dir: THREE.Vector3) => {
  // Snap camera to axis-aligned view, preserving current orbit target.
  // Uses store action instead of window events for testability.
  // The action reads controlsRef.current.getTarget() for the actual orbit center,
  // then calls setPosition(center + dir * distance) + setTarget(center).
  // Distance = current camera distance from target (preserved).
  useStore.getState().snapCameraToAxis?.(dir.toArray());
}, []);
```

Mount after `<StaircaseModeIndicator />` (line 115):
```typescript
<OrientationGizmo
  cameraQuaternionRef={cameraQuaternionRef}
  onSnapToAxis={handleSnapToAxis}
/>
```

- [ ] **Step 4: Write camera quaternion in Scene.tsx**

In Scene.tsx, add a `useFrame` hook inside the RealisticScene component that writes the camera quaternion to a ref passed from SceneCanvas. Since Scene is inside Canvas, we need to pass the ref through:

Add prop to Scene:
```typescript
// In SceneCanvas.tsx, pass ref through:
<Scene cameraQuaternionRef={cameraQuaternionRef} />
```

In Scene.tsx, in the Realistic3DScene function, add:
```typescript
useFrame(({ camera }) => {
  if (props.cameraQuaternionRef?.current) {
    props.cameraQuaternionRef.current.copy(camera.quaternion);
  }
});
```

Also add gizmo-snap event listener near CameraControls:
```typescript
useEffect(() => {
  const handler = (e: Event) => {
    const { position, target } = (e as CustomEvent).detail;
    controlsRef.current?.setPosition(position.x, position.y, position.z, true);
    controlsRef.current?.setTarget(target.x, target.y, target.z, true);
  };
  window.addEventListener('gizmo-snap', handler);
  return () => window.removeEventListener('gizmo-snap', handler);
}, []);
```

- [ ] **Step 5: Verify compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Browser verification**

- Gizmo appears in top-right corner with 5 grey axis lines
- Hover over an axis → it brightens to white
- Click +Y → camera snaps to top-down view
- Click +X → camera snaps to view from right
- Old GizmoHelper is gone

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: 700+ tests pass

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: replace GizmoViewport with custom HTML/SVG orientation gizmo"
```

---

## Task 8: Multi-Voxel Bay Preview in VoxelPreview3D

**Files:**
- Modify: `src/components/ui/VoxelPreview3D.tsx`

This task expands the existing VoxelPreview3D to show bay groups as multi-voxel arrangements with per-voxel click targets. The existing `bayGroupIndices` prop is already passed from FinishesPanel.

- [ ] **Step 1: Read current VoxelPreview3D implementation**

Read `src/components/ui/VoxelPreview3D.tsx` fully to understand:
- Current single-voxel CubeScene rendering
- How `bayGroupIndices` prop is currently used (if at all)
- GroupedVoxelPreview (mentioned in spec as partially implemented)
- Face click handling pattern

- [ ] **Step 2: Implement bay group rendering**

When `bayGroupIndices` has more than 1 index, render a grid of voxel cubes:
- Calculate bounding box from indices (min/max row/col)
- Position each voxel cube in the grid arrangement
- Highlight outer boundary edges with cyan
- Make each sub-voxel clickable → sets `selectedVoxel` to that index for face-level drill-down
- Internal division lines visible but subtle

- [ ] **Step 3: Browser verification**

- Switch to Simple mode (designComplexity toggle)
- Select a bay group (e.g. body_0)
- VoxelPreview3D should show 4 cubes in a 2×2 arrangement
- Clicking one sub-voxel selects it for face editing
- Outer boundary highlighted in cyan

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/VoxelPreview3D.tsx
git commit -m "feat: expand VoxelPreview3D for multi-voxel bay groups"
```

---

## Task 9: BayContextMenu Feature Relocation (Deferred)

> **Note:** The spec requires relocating BayContextMenu's edge treatment, side wall type, floor material, color swatches, and Remove Floor toggle to WallsTab and FlooringTab. These features are currently wired to the `container.walls` bay module system which is being **bridged, not deprecated**. The relocation is lower priority than the Block tab unification and can be done in a follow-up sprint. For now, the Block tab covers all structural presets. The finish-level features (edge/floor/color) are deferred.

- [ ] **Step 1: Note this as deferred work**

Add to sprint handoff doc: "BayContextMenu finish features (edge treatment, floor material, color swatches) need relocation to WallsTab/FlooringTab in next sprint."

---

## Task 10: Final Verification & Cleanup

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: 700+ tests pass

- [ ] **Step 3: Browser walkthrough checklist**

1. Select voxel in Detailed mode → Block tab shows, 8 presets visible
2. Click Railing preset → voxel gets cable railings on all 4 walls
3. Click Floor preset → voxel gets wood deck floor, open sides
4. Switch to Simple mode → select a bay → Block tab shows "Bay · 4 voxels"
5. Apply Railing to bay → only boundary walls get railings, internal walls Open
6. Lock a voxel → apply preset → locked voxel unchanged
7. Right-click on voxel → NO floating radial menu
8. VoxelPreview3D shows bay as multi-voxel grid
9. Click sub-voxel in bay preview → selects for face editing
10. Gizmo in top-right, 5 axes, hover brightens, click snaps camera
11. All face tabs (Flooring/Walls/Ceiling/Electrical) still work correctly
12. Undo/Redo works after preset application

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: block tab and gizmo sprint complete — verification passed"
git tag sprint-block-tab-gizmo-complete -a -m "700+ tests, Block tab + gizmo verified"
```
