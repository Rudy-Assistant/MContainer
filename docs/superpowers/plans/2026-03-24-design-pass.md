# Design Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the UI card system, add a Container tab, ghost preview on hover, inspector cleanup, hotbar layout fix, and multi-select across 6 coordinated changes.

**Architecture:** Foundation-first approach: build shared PresetCard + isometric SVG components, then layer features on top. Selection model migration (Tasks 18-20) is the riskiest change — it replaces 3 store fields across 31 source files. All other tasks are additive.

**Tech Stack:** React 19, Three.js / React Three Fiber, Zustand 5 (immer + persist + temporal), Lucide React icons, inline CSS-in-JS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-24-design-pass-spec.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/components/ui/finishes/PresetCard.tsx` | Shared square card component (content slot + label) |
| `src/components/ui/svg/IsometricVoxelSVG.tsx` | Programmatic isometric cube SVG from VoxelFaces |
| `src/components/ui/svg/IsometricItemSVG.tsx` | Hand-crafted isometric SVGs for electrical items |
| `src/components/ui/svg/surfaceColorMap.ts` | SurfaceType → hex color mapping |
| `src/config/containerTabPresets.ts` | Container-level preset definitions (face configs) |
| `src/components/ui/finishes/ContainerTab.tsx` | Container tab: mode toggles, preset row, spatial grid |
| `src/components/ui/finishes/SpatialVoxelGrid.tsx` | Named cell grid (NW Corner, Bay 1, etc.) |
| `src/components/ui/finishes/ContainerPresetRow.tsx` | 5-card container preset row (All Deck, Interior, etc.) |
| `src/__tests__/container-tab-presets.test.ts` | Tests for container-level preset application |
| `src/__tests__/preset-card.test.ts` | Tests for IsometricVoxelSVG color mapping |
| `src/__tests__/selection-elements.test.ts` | Tests for typed selection context model |
| `src/__tests__/ghost-preview.test.ts` | Tests for ghost preset store logic |

### Modified Files

| File | Changes |
|------|---------|
| `src/app/globals.css` | Add `--accent-muted`, update `--hotbar-bg` |
| `src/components/ui/finishes/BlockTab.tsx` | Replace preset buttons with PresetCard + IsometricVoxelSVG |
| `src/components/ui/finishes/OptionCardGrid.tsx` | Replace with PresetCard + IsometricItemSVG |
| `src/components/ui/finishes/TextureSwatchGrid.tsx` | Replace button internals with PresetCard wrapping `<img>` |
| `src/components/ui/finishes/FinishesPanel.tsx` | Add Container tab, update tab routing |
| `src/components/ui/finishes/FinishesTabBar.tsx` | Add 'container' tab to FINISH_TABS |
| `src/components/ui/finishes/ElectricalTab.tsx` | Switch from OptionCardGrid to PresetCard |
| `src/store/slices/uiSlice.ts` | Add ghostPreset state + actions |
| `src/store/slices/selectionSlice.ts` | Replace selectedVoxel/selectedVoxels/selectedFace with selectedElements |
| `src/hooks/useSelectionTarget.ts` | Derive from selectedElements instead of old fields |
| `src/components/ui/MatrixEditor.tsx` | Remove S/D text labels, legend, cable info, scope text; add Lucide toggle icon; wire multi-select |
| `src/components/ui/SmartHotbar.tsx` | Responsive sidebar offset, transparency, remove dots, readable text; update 2 selection call sites |
| `src/components/three/SceneCanvas.tsx` | Clear ghost on pointer miss, update selection clears |
| `src/components/objects/ContainerSkin.tsx` | Update 14 selection call sites |
| `src/components/objects/HoverPreviewGhost.tsx` | Extend existing ghost component for preset hover preview |
| `src/components/ui/VoxelPreview3D.tsx` | Update 2 selection call sites |
| `src/components/three/BlueprintRenderer.tsx` | Update selection call sites |
| `src/components/three/ContainerMesh.tsx` | Update ~30 selection read references |
| `src/components/three/Scene.tsx` | Update selection call sites |
| `src/components/three/FaceContextWidget.tsx` | Update ~8 selectedFace read references |
| `src/components/ui/ContainerContextMenu.tsx` | Update 1 selection call site |
| `src/components/ui/FaceStrip.tsx` | Update 2 selection call sites |
| `src/components/ui/WarningPopover.tsx` | Update 4 selection call sites |
| `src/components/ui/Sidebar.tsx` | Update selection reads + clearSelection call |
| `src/components/ui/TopToolbar.tsx` | Update clearSelection call |
| `src/components/ui/IsoEditor.tsx` | Update ~7 selection read references |
| `src/components/ui/RecentItemsBar.tsx` | Update ~7 selection read references |
| `src/components/ui/WallTypePicker.tsx` | Update ~5 selectedFace read references |
| `src/components/ui/UserLibrary.tsx` | Update ~2 selection read references |
| `src/store/slices/containerSlice.ts` | Update 1 direct selectedVoxel write |
| `src/store/slices/voxelSlice.ts` | Update ~2 selection references |
| `src/store/containerStore.ts` | Update ~2 selection references |
| `src/config/wallTypes.ts` | Update selection references if any |

---

## Task 1: CSS Variable Additions

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add `--accent-muted` to light mode**

In `src/app/globals.css`, inside the `:root` block (after line 33 `--danger`), add:

```css
  --accent-muted: rgba(37, 99, 235, 0.5);
```

- [ ] **Step 2: Add `--accent-muted` to dark mode**

In the `[data-theme="dark"]` block (after the existing `--danger` line), add:

```css
  --accent-muted: rgba(59, 130, 246, 0.5);
```

- [ ] **Step 3: Update `--hotbar-bg` values**

In `:root`, change:
```css
  --hotbar-bg: rgba(255, 255, 255, 0.92);
```
to:
```css
  --hotbar-bg: rgba(255, 255, 255, 0.15);
```

In `[data-theme="dark"]`, change the corresponding `--hotbar-bg` to:
```css
  --hotbar-bg: rgba(15, 23, 42, 0.15);
```

- [ ] **Step 4: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: 0 errors (CSS-only change)

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add --accent-muted CSS variable, update --hotbar-bg transparency"
```

---

## Task 2: Surface Color Map

**Files:**
- Create: `src/components/ui/svg/surfaceColorMap.ts`
- Test: `src/__tests__/preset-card.test.ts`

- [ ] **Step 1: Write the test**

Create `src/__tests__/preset-card.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { surfaceColor, SURFACE_COLOR_MAP } from '@/components/ui/svg/surfaceColorMap';
import type { SurfaceType } from '@/types/container';

describe('surfaceColorMap', () => {
  it('returns correct color for known SurfaceType', () => {
    expect(surfaceColor('Open')).toBe('#e2e8f0');
    expect(surfaceColor('Deck_Wood')).toBe('#8B6914');
    expect(surfaceColor('Glass_Pane')).toBe('#93c5fd');
    expect(surfaceColor('Solid_Steel')).toBe('#64748b');
  });

  it('returns fallback for unknown SurfaceType', () => {
    expect(surfaceColor('SomeNewType' as SurfaceType)).toBe('#cbd5e1');
  });

  it('covers all Window variants with Glass_Pane color', () => {
    expect(surfaceColor('Window_Standard')).toBe('#93c5fd');
    expect(surfaceColor('Window_Sill')).toBe('#93c5fd');
    expect(surfaceColor('Window_Clerestory')).toBe('#93c5fd');
    expect(surfaceColor('Window_Half')).toBe('#93c5fd');
  });

  it('distinguishes Railing_Cable from Railing_Glass', () => {
    expect(surfaceColor('Railing_Cable')).toBe('#94a3b8');
    expect(surfaceColor('Railing_Glass')).toBe('#7dd3fc');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/__tests__/preset-card.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create directory and implement surfaceColorMap**

Create the directory `src/components/ui/svg/` (does not exist yet), then create `src/components/ui/svg/surfaceColorMap.ts`:

```ts
import type { SurfaceType } from '@/types/container';

export const SURFACE_COLOR_MAP: Record<string, string> = {
  Open:               '#e2e8f0',
  Solid_Steel:        '#64748b',
  Glass_Pane:         '#93c5fd',
  Railing_Cable:      '#94a3b8',
  Railing_Glass:      '#7dd3fc',
  Deck_Wood:          '#8B6914',
  Concrete:           '#9ca3af',
  Gull_Wing:          '#78716c',
  Half_Fold:          '#78716c',
  Door:               '#475569',
  Stairs:             '#6b7280',
  Stairs_Down:        '#6b7280',
  Wood_Hinoki:        '#d4a574',
  Floor_Tatami:       '#84a66f',
  Wall_Washi:         '#faf5ef',
  Glass_Shoji:        '#e8e8e8',
  Window_Standard:    '#93c5fd',
  Window_Sill:        '#93c5fd',
  Window_Clerestory:  '#93c5fd',
  Window_Half:        '#93c5fd',
};

const FALLBACK = '#cbd5e1';

export function surfaceColor(type: SurfaceType): string {
  return SURFACE_COLOR_MAP[type] ?? FALLBACK;
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/__tests__/preset-card.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/svg/surfaceColorMap.ts src/__tests__/preset-card.test.ts
git commit -m "feat: add SurfaceType color mapping for isometric SVGs"
```

---

## Task 3: IsometricVoxelSVG Component

**Files:**
- Create: `src/components/ui/svg/IsometricVoxelSVG.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/svg/IsometricVoxelSVG.tsx`:

```tsx
'use client';

import type { VoxelFaces } from '@/types/container';
import { surfaceColor } from './surfaceColorMap';

interface IsometricVoxelSVGProps {
  faces: VoxelFaces;
  size?: number;
}

/**
 * Isometric cube SVG showing 3 visible faces (top, front/south, right/east).
 * 60×60 viewBox rendered at `size` pixels (default 64).
 */
export function IsometricVoxelSVG({ faces, size = 64 }: IsometricVoxelSVGProps) {
  const topColor = surfaceColor(faces.top);
  const frontColor = surfaceColor(faces.s);    // south = front in isometric
  const rightColor = surfaceColor(faces.e);    // east = right in isometric
  const isOpenTop = faces.top === 'Open';
  const isOpenFront = faces.s === 'Open';
  const isOpenRight = faces.e === 'Open';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Top face */}
      <polygon
        points="30,8 50,20 30,32 10,20"
        fill={topColor}
        stroke={isOpenTop ? '#94a3b8' : '#475569'}
        strokeWidth={isOpenTop ? 0.8 : 0.5}
        strokeDasharray={isOpenTop ? '2 2' : 'none'}
        opacity={isOpenTop ? 0.5 : 1}
      />
      {/* Front face (south) */}
      <polygon
        points="10,20 30,32 30,52 10,40"
        fill={frontColor}
        stroke={isOpenFront ? '#94a3b8' : '#475569'}
        strokeWidth={isOpenFront ? 0.8 : 0.5}
        strokeDasharray={isOpenFront ? '2 2' : 'none'}
        opacity={isOpenFront ? 0.5 : 1}
      />
      {/* Right face (east) */}
      <polygon
        points="30,32 50,20 50,40 30,52"
        fill={rightColor}
        stroke={isOpenRight ? '#94a3b8' : '#475569'}
        strokeWidth={isOpenRight ? 0.8 : 0.5}
        strokeDasharray={isOpenRight ? '2 2' : 'none'}
        opacity={isOpenRight ? 0.5 : 1}
      />
    </svg>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/svg/IsometricVoxelSVG.tsx
git commit -m "feat: add IsometricVoxelSVG programmatic isometric cube component"
```

---

## Task 4: IsometricItemSVG Component

**Files:**
- Create: `src/components/ui/svg/IsometricItemSVG.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/svg/IsometricItemSVG.tsx` with hand-crafted SVG paths for electrical items: `switch`, `outlet`, `dimmer`, `double_switch`, `pendant`, `flush`, `track`, `recessed`. Each renders a small isometric drawing of the item (wall plate with toggle, wall plate with slots, etc.). Use a `switch` statement on `itemId` to select the SVG content, with a fallback grey circle for unknown items.

The SVG viewBox should be 60×60, matching IsometricVoxelSVG. Props: `{ itemId: string; size?: number }` with default size 64.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/svg/IsometricItemSVG.tsx
git commit -m "feat: add IsometricItemSVG hand-crafted electrical item icons"
```

---

## Task 5: PresetCard Component

**Files:**
- Create: `src/components/ui/finishes/PresetCard.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/finishes/PresetCard.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';

interface PresetCardProps {
  content: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function PresetCard({
  content, label, active, onClick, onMouseEnter, onMouseLeave,
}: PresetCardProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        aspectRatio: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        border: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        borderRadius: 6,
        background: 'var(--surface)',
        cursor: 'pointer',
        padding: 4,
        transition: 'border-color 100ms',
        width: '100%',
      }}
    >
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {content}
      </span>
      <span style={{
        fontSize: 10,
        color: active ? 'var(--text-main)' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
        lineHeight: 1.3,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}>
        {label}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/finishes/PresetCard.tsx
git commit -m "feat: add shared PresetCard component for unified card UI"
```

---

## Task 6: Replace BlockTab with PresetCard + IsometricVoxelSVG

**Files:**
- Modify: `src/components/ui/finishes/BlockTab.tsx`

- [ ] **Step 1: Read current BlockTab**

Read `src/components/ui/finishes/BlockTab.tsx` (112 lines). Note: 4-column grid, Lucide icon per preset, active state detection via face comparison.

- [ ] **Step 2: Replace preset grid with PresetCard**

Replace the 4-column grid with a 3-column grid using PresetCard + IsometricVoxelSVG:

- Remove Lucide icon imports (`Footprints, ArrowUpFromDot, Layers, Fence, AppWindow, ChevronsUpDown, Origami` — keep `Lock, Unlock, Copy, RotateCcw` for action buttons)
- Import `PresetCard` and `IsometricVoxelSVG`
- Change `gridTemplateColumns: 'repeat(4, 1fr)'` → `'repeat(3, 1fr)'`
- Replace each preset button with:
  ```tsx
  <PresetCard
    content={<IsometricVoxelSVG faces={preset.faces} />}
    label={preset.label}
    active={activePresetId === preset.id}
    onClick={() => applyBlockConfig(containerId, indices, preset.id)}
  />
  ```
- Remove the "Structural Presets" label if present above the grid

- [ ] **Step 3: Type check and test**

Run: `npx tsc --noEmit && npx vitest run src/__tests__/block-presets.test.ts`
Expected: 0 errors, all block preset tests pass

- [ ] **Step 4: Browser verify**

Run `npm run dev`, open the app, select a voxel, confirm Block tab shows isometric cube previews in 3-col grid. Click a preset and verify it applies correctly.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/finishes/BlockTab.tsx
git commit -m "feat: replace BlockTab Lucide icons with isometric SVG PresetCards"
```

---

## Task 7: Replace OptionCardGrid and ElectricalTab with PresetCard

**Files:**
- Modify: `src/components/ui/finishes/OptionCardGrid.tsx`
- Modify: `src/components/ui/finishes/ElectricalTab.tsx`

- [ ] **Step 1: Read current files**

Read `src/components/ui/finishes/OptionCardGrid.tsx` (51 lines) and `src/components/ui/finishes/ElectricalTab.tsx` (56 lines).

- [ ] **Step 2: Replace OptionCardGrid internals**

Replace the button internals in OptionCardGrid with PresetCard + IsometricItemSVG. The grid changes from custom buttons to:

```tsx
<PresetCard
  content={<IsometricItemSVG itemId={item.id} />}
  label={item.label}
  active={item.id === activeId}
  onClick={() => onSelect(item.id, item.label)}
/>
```

Keep the same 3-column grid layout and the `label` heading above. Update imports.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/finishes/OptionCardGrid.tsx src/components/ui/finishes/ElectricalTab.tsx
git commit -m "feat: replace OptionCardGrid with PresetCard + IsometricItemSVG"
```

---

## Task 8: Replace TextureSwatchGrid with PresetCard

**Files:**
- Modify: `src/components/ui/finishes/TextureSwatchGrid.tsx`

- [ ] **Step 1: Read current file**

Read `src/components/ui/finishes/TextureSwatchGrid.tsx` (79 lines). Note: SwatchButton with image, hover state, noise swatch fallback.

- [ ] **Step 2: Replace with PresetCard wrapping image**

Replace SwatchButton internals with PresetCard. The `content` slot receives the texture `<img>` (with the existing `getSwatchSrc` / `generateNoiseSwatch` fallback logic):

```tsx
<PresetCard
  content={
    <img
      src={src}
      alt={item.label}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }}
    />
  }
  label={item.label}
  active={item.id === activeId}
  onClick={() => onSelect(item.id, item.label)}
/>
```

Keep the 3-column grid, gap 6px. Remove the separate SwatchButton component.

- [ ] **Step 3: Type check and browser verify**

Run: `npx tsc --noEmit`
Then verify in browser: Flooring/Walls/Ceiling tabs show texture thumbnails in square PresetCards.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/finishes/TextureSwatchGrid.tsx
git commit -m "feat: replace TextureSwatchGrid with PresetCard wrapping texture images"
```

---

## Task 9: Container-Level Preset Definitions

**Files:**
- Create: `src/config/containerTabPresets.ts`

- [ ] **Step 1: Create preset definitions**

Create `src/config/containerTabPresets.ts` with 5 container-level presets. Each defines a VoxelFaces config to apply to every voxel:

```ts
import type { VoxelFaces } from '@/types/container';

export interface ContainerLevelPreset {
  id: string;
  label: string;
  faces: VoxelFaces;  // representative face config for preview + application
}

export const CONTAINER_LEVEL_PRESETS: ContainerLevelPreset[] = [
  {
    id: 'all_deck',
    label: 'All Deck',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' },
  },
  {
    id: 'interior',
    label: 'Interior',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'n_deck',
    label: 'N Deck',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 's_deck',
    label: 'S Deck',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Railing_Cable', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
  {
    id: 'retract',
    label: 'Retract',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Half_Fold', s: 'Half_Fold', e: 'Solid_Steel', w: 'Solid_Steel' },
  },
];
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/config/containerTabPresets.ts
git commit -m "feat: add container-level preset definitions (All Deck, Interior, etc.)"
```

---

## Task 10: SpatialVoxelGrid Component

**Files:**
- Create: `src/components/ui/finishes/SpatialVoxelGrid.tsx`

- [ ] **Step 1: Create the spatial grid component**

Create `src/components/ui/finishes/SpatialVoxelGrid.tsx`. This renders the named-cell grid:

- Display Row 0: NW Corner, N Deck 1–3, NE Corner (voxel row 0)
- Display Row 1: W End, Bay 1–3, E End (voxel rows 1+2 collapsed)
- Display Row 2: SW Corner, S Deck 1–3, SE Corner (voxel row 3)

Props: `{ containerId: string; onCellClick: (indices: number[]) => void }`

Each cell is a button. Bay cells use the bay group indices (Bay 1 = v10+11+18+19). Corner/end cells are greyed out with smaller text. Simple mode shows bays as single cells; Detail mode expansion (two body sub-rows) is deferred — implement Simple mode first.

**Note:** Selection highlighting is deferred until after Task 18 (selectedElements). Initially render cells without selection state. A follow-up step in Task 21 will wire selection highlighting after the selection model is in place. For now, read the OLD `selectedVoxels` field for basic highlight and add this file to the Task 19 migration list.

Use a CSS Grid with `gridTemplateColumns: 'repeat(5, 1fr)'` for the 5-column spatial layout.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/finishes/SpatialVoxelGrid.tsx
git commit -m "feat: add SpatialVoxelGrid component for container tab"
```

---

## Task 11: ContainerPresetRow Component

**Files:**
- Create: `src/components/ui/finishes/ContainerPresetRow.tsx`

- [ ] **Step 1: Create the preset row**

Create `src/components/ui/finishes/ContainerPresetRow.tsx`. Renders 5 PresetCards in a horizontal row with `gridTemplateColumns: 'repeat(5, 1fr)'`:

```tsx
import { PresetCard } from './PresetCard';
import { IsometricVoxelSVG } from '../svg/IsometricVoxelSVG';
import { CONTAINER_LEVEL_PRESETS } from '@/config/containerTabPresets';

interface Props {
  containerId: string;
  onApply: (presetId: string) => void;
}

export function ContainerPresetRow({ containerId, onApply }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
      {CONTAINER_LEVEL_PRESETS.map(p => (
        <PresetCard
          key={p.id}
          content={<IsometricVoxelSVG faces={p.faces} size={48} />}
          label={p.label}
          active={false}
          onClick={() => onApply(p.id)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/finishes/ContainerPresetRow.tsx
git commit -m "feat: add ContainerPresetRow with 5-column isometric preset cards"
```

---

## Task 12: Container Tab + FinishesPanel Integration

**Files:**
- Create: `src/components/ui/finishes/ContainerTab.tsx`
- Modify: `src/components/ui/finishes/FinishesPanel.tsx`
- Modify: `src/components/ui/finishes/FinishesTabBar.tsx`

- [ ] **Step 1: Read current FinishesPanel and FinishesTabBar**

Read both files to understand current tab bar definition and tab routing.

- [ ] **Step 2: Add 'container' to FinishesTabBar**

In `src/components/ui/finishes/FinishesTabBar.tsx`, add `{ id: 'container', label: 'Container' }` as the first entry in `FINISH_TABS`. Update the `FinishTab` type to include `'container'`.

- [ ] **Step 3: Create ContainerTab**

Create `src/components/ui/finishes/ContainerTab.tsx`. Layout top-to-bottom:

1. **VoxelPreview3D** — Reuse the existing VoxelPreview3D component at the top, passing `containerId` and `bayGroupIndices` when in Simple mode. This shows the full container / multi-voxel bay preview with hoverable/selectable faces.
2. Mode toggle icons row (Floor/Ceiling toggle using Lucide `Layers`/`SquareStack`, Frame toggle using Lucide `Box`). Read `inspectorView` and `frameMode` from store.
3. ContainerPresetRow (the 5-card row)
4. SpatialVoxelGrid

Props: `{ containerId: string }`

Wire the container-level preset apply action: when a preset card is clicked, iterate all active voxels in the container and apply the preset's face config via `setVoxelFaces` (or the appropriate store action from voxelSlice).

- [ ] **Step 4: Write container preset application test**

Create `src/__tests__/container-tab-presets.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import { CONTAINER_LEVEL_PRESETS } from '@/config/containerTabPresets';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
  useStore.setState({ designMode: 'manual' });
}

describe('container-level preset application', () => {
  beforeEach(resetStore);

  it('applies Interior preset to all active body voxels', () => {
    const cid = useStore.getState().addContainer(ContainerSize.HighCube40);
    const interior = CONTAINER_LEVEL_PRESETS.find(p => p.id === 'interior')!;
    const grid = useStore.getState().containers[cid]!.voxelGrid!;
    const activeIndices = grid.map((v, i) => v.active ? i : -1).filter(i => i >= 0);

    // Apply to all active voxels
    for (const idx of activeIndices) {
      useStore.getState().setVoxelFaces(cid, idx, interior.faces);
    }

    const updated = useStore.getState().containers[cid]!.voxelGrid!;
    for (const idx of activeIndices) {
      expect(updated[idx].faces.top).toBe('Solid_Steel');
      expect(updated[idx].faces.bottom).toBe('Deck_Wood');
    }
  });
});
```

Run: `npx vitest run src/__tests__/container-tab-presets.test.ts`

- [ ] **Step 5: Update FinishesPanel tab routing**

In `src/components/ui/finishes/FinishesPanel.tsx`, add the Container tab to the conditional rendering:

```tsx
{activeTab === 'container' && <ContainerTab containerId={containerId} />}
```

- [ ] **Step 6: Type check and browser verify**

Run: `npx tsc --noEmit`
Then verify in browser: Container tab appears first in tab bar, shows VoxelPreview3D, mode toggles, preset row, and spatial grid.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/finishes/ContainerTab.tsx src/components/ui/finishes/FinishesPanel.tsx src/components/ui/finishes/FinishesTabBar.tsx
git commit -m "feat: add Container tab to FinishesPanel with mode toggles, presets, spatial grid"
```

---

## Task 13: Ghost Preview Store State

**Files:**
- Modify: `src/store/slices/uiSlice.ts`
- Test: `src/__tests__/ghost-preview.test.ts`

- [ ] **Step 1: Write the test**

Create `src/__tests__/ghost-preview.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('ghostPreset store', () => {
  beforeEach(resetStore);

  it('starts null', () => {
    expect(useStore.getState().ghostPreset).toBeNull();
  });

  it('setGhostPreset stores preset', () => {
    const preset = {
      source: 'block' as const,
      faces: { top: 'Open' as const, bottom: 'Deck_Wood' as const, n: 'Open' as const, s: 'Open' as const, e: 'Open' as const, w: 'Open' as const },
      targetScope: 'voxel' as const,
    };
    useStore.getState().setGhostPreset(preset);
    expect(useStore.getState().ghostPreset).toEqual(preset);
  });

  it('clearGhostPreset sets null', () => {
    useStore.getState().setGhostPreset({
      source: 'block',
      faces: { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' },
      targetScope: 'voxel',
    });
    useStore.getState().clearGhostPreset();
    expect(useStore.getState().ghostPreset).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/__tests__/ghost-preview.test.ts`
Expected: FAIL — ghostPreset/setGhostPreset not in store

- [ ] **Step 3: Add ghostPreset to uiSlice**

In `src/store/slices/uiSlice.ts`:

Add to interface:
```ts
ghostPreset: {
  source: 'block' | 'container';
  faces: VoxelFaces;
  targetScope: 'voxel' | 'bay' | 'container';
} | null;
setGhostPreset: (g: { source: 'block' | 'container'; faces: VoxelFaces; targetScope: 'voxel' | 'bay' | 'container' } | null) => void;
clearGhostPreset: () => void;
```

Add to implementation:
```ts
ghostPreset: null,
setGhostPreset: (g) => set({ ghostPreset: g }),
clearGhostPreset: () => set({ ghostPreset: null }),
```

Import `VoxelFaces` from `@/types/container` if not already imported.

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/__tests__/ghost-preview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/slices/uiSlice.ts src/__tests__/ghost-preview.test.ts
git commit -m "feat: add ghostPreset state to uiSlice for hover preview"
```

---

## Task 14: Wire Ghost Preview to PresetCards

**Files:**
- Modify: `src/components/ui/finishes/BlockTab.tsx`
- Modify: `src/components/ui/finishes/ContainerPresetRow.tsx`

- [ ] **Step 1: Add onMouseEnter/Leave to BlockTab PresetCards**

In BlockTab, wire the `onMouseEnter` and `onMouseLeave` on each PresetCard:

```tsx
onMouseEnter={() => setGhostPreset({
  source: 'block',
  faces: preset.faces,
  targetScope: indices.length > 1 ? 'bay' : 'voxel',
})}
onMouseLeave={() => clearGhostPreset()}
```

Get `setGhostPreset` and `clearGhostPreset` from the store.

- [ ] **Step 2: Add onMouseEnter/Leave to ContainerPresetRow**

Same pattern for container presets, with `source: 'container'` and `targetScope: 'container'`.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/finishes/BlockTab.tsx src/components/ui/finishes/ContainerPresetRow.tsx
git commit -m "feat: wire ghost preview hover triggers on block and container preset cards"
```

---

## Task 15: Extend Existing HoverPreviewGhost + Ghost Clearing

**Files:**
- Modify: `src/components/objects/HoverPreviewGhost.tsx` (already exists — 109 lines)
- Modify: `src/components/three/SceneCanvas.tsx`
- Modify: `src/components/ui/finishes/FinishesPanel.tsx` (ghost clearing on tab switch / panel close)
- Modify: `src/components/ui/Sidebar.tsx` (ghost clearing on sidebar collapse)

- [ ] **Step 1: Read existing HoverPreviewGhost**

Read `src/components/objects/HoverPreviewGhost.tsx` (109 lines). Understand its current rendering pattern and props. Extend it, don't replace.

- [ ] **Step 2: Extend HoverPreviewGhost for ghostPreset**

Modify `src/components/objects/HoverPreviewGhost.tsx`:

- Read `ghostPreset` from store
- If null, return null (or fall through to existing logic if it handles other ghosts)
- Render transparent face geometry over target voxels using the preset's face colors
- Uses `useFrame` for pulse animation (opacity 0.25↔0.40 over 800ms)
- Material: `MeshBasicMaterial`, transparent, depthWrite false
- For 'container' scope: skip extension positions where adjacent container exists (check `container.neighbors` or adjacency data from containerSlice)

- [ ] **Step 3: Add ghost clearing to SceneCanvas onPointerMissed**

In SceneCanvas.tsx `onPointerMissed` handler (currently clears hover/selection state), add `clearGhostPreset()`.

- [ ] **Step 4: Wire ghost clearing on tab switch, panel close, sidebar collapse**

- In `FinishesTabBar.tsx` or `FinishesPanel.tsx`: call `clearGhostPreset()` when `activeTab` changes
- In `FinishesPanel.tsx`: call `clearGhostPreset()` when panel closes (the close button handler)
- In `Sidebar.tsx`: call `clearGhostPreset()` when sidebar collapses

- [ ] **Step 5: Type check and browser verify**

Run: `npx tsc --noEmit`
Then verify: hover over a Block tab preset card and confirm a transparent ghost appears on the selected voxel in the 3D viewport. Ghost clears on mouse leave, tab switch, and panel close.

- [ ] **Step 6: Commit**

```bash
git add src/components/objects/HoverPreviewGhost.tsx src/components/three/SceneCanvas.tsx src/components/ui/finishes/FinishesPanel.tsx src/components/ui/Sidebar.tsx
git commit -m "feat: extend HoverPreviewGhost for preset hover, add clearing triggers"
```

---

## Task 16: Inspector Cleanup

**Files:**
- Modify: `src/components/ui/MatrixEditor.tsx`

- [ ] **Step 1: Read MatrixEditor header area**

Read `src/components/ui/MatrixEditor.tsx` fully. Identify:
- S/D toggle buttons (the letter buttons in header icon row)
- Legend section
- Cable info text
- Scope text
- "Structural Presets" label (if in this file; may be in FinishesPanel)

- [ ] **Step 2: Replace S/D toggle with Lucide icon**

Replace the two separate `S` and `D` letter buttons with a single toggle button using Lucide `Grid2x2` (Simple) / `Grid3x3` (Detail):

```tsx
import { Grid2x2, Grid3x3 } from 'lucide-react';

// In header icon row:
<button onClick={toggleComplexity} title={isDetail ? 'Switch to Simple' : 'Switch to Detail'}>
  {isDetail
    ? <Grid3x3 size={16} color="var(--accent)" />
    : <Grid2x2 size={16} color="var(--text-muted)" />}
</button>
```

- [ ] **Step 3: Remove legend, cable info, scope text**

Delete the JSX blocks rendering:
- Color legend / key
- Cable info text
- Scope text display
- Any "Structural Presets" label

- [ ] **Step 4: Type check and browser verify**

Run: `npx tsc --noEmit`
Then verify: inspector header is cleaner, single toggle icon works, removed elements are gone.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/MatrixEditor.tsx
git commit -m "feat: inspector cleanup — replace S/D toggle with icon, remove legend/cable/scope text"
```

---

## Task 17: Bottom Hotbar Layout

**Files:**
- Modify: `src/components/ui/SmartHotbar.tsx`

- [ ] **Step 1: Read SmartHotbar positioning code**

Read `src/components/ui/SmartHotbar.tsx`. Find:
- The outer container positioning styles (left/bottom/transform)
- Background/opacity values
- Icon dot rendering
- Label font styles

- [ ] **Step 2: Add responsive sidebar offset**

Replace the static `left: "50%", transform: "translateX(-50%)"` with sidebar-aware centering:

```tsx
const sidebarCollapsed = useStore(s => s.sidebarCollapsed);
// Get viewport width via window.innerWidth or a resize hook
const sidebarWidth = sidebarCollapsed ? 0 : 320;
const centerX = sidebarWidth + (window.innerWidth - sidebarWidth) / 2;
```

Apply: `left: centerX, transform: 'translateX(-50%)'`

**Important:** Do NOT use `window.innerWidth` directly in render — it's SSR-unsafe and recomputes per render. Use a `useState` + `useEffect` with a resize event listener:

```tsx
const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
useEffect(() => {
  const onResize = () => setViewportWidth(window.innerWidth);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, []);
```

- [ ] **Step 3: Update transparency**

Change the background to read from `var(--hotbar-bg)` (already updated in Task 1 to 0.15 opacity). Add backdrop-filter:

```tsx
background: 'var(--hotbar-bg)',
backdropFilter: 'blur(20px) saturate(1.4)',
border: '1px solid rgba(255, 255, 255, 0.12)',
```

- [ ] **Step 4: Remove icon dots**

Find and remove the colored dot/circle indicators on preset slots. The slot content (SVG/swatch) is sufficient.

- [ ] **Step 5: Update label text styling**

Change slot label styles from:
```tsx
fontSize: 8, textTransform: 'uppercase', fontFamily: 'monospace'
```
to:
```tsx
fontSize: 10,
fontWeight: 500,
color: 'var(--text-main)',
letterSpacing: '0.02em',
textShadow: '0 1px 3px rgba(0,0,0,0.3)',
```

- [ ] **Step 6: Type check and browser verify**

Run: `npx tsc --noEmit`
Then verify: hotbar centers to right of sidebar when open, is more transparent, no dots, readable text.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/SmartHotbar.tsx
git commit -m "feat: hotbar responsive offset, increased transparency, readable labels"
```

---

## Task 18: Selection Model — Typed Selection Context (Store)

**Files:**
- Modify: `src/store/slices/selectionSlice.ts`
- Test: `src/__tests__/selection-elements.test.ts`

This is the riskiest task — it replaces 3 fields across 38 call sites. Do the store change first, then migrate call sites file-by-file in Tasks 19-20.

- [ ] **Step 1: Write the tests**

Create `src/__tests__/selection-elements.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('selectedElements — typed selection context', () => {
  beforeEach(resetStore);

  it('starts null', () => {
    expect(useStore.getState().selectedElements).toBeNull();
  });

  it('setSelectedElements stores typed selection', () => {
    const sel = { type: 'voxel' as const, items: [{ containerId: 'c1', id: '10' }] };
    useStore.getState().setSelectedElements(sel);
    expect(useStore.getState().selectedElements).toEqual(sel);
  });

  it('type change clears previous items', () => {
    useStore.getState().setSelectedElements({ type: 'wall', items: [{ containerId: 'c1', id: '10:n' }] });
    useStore.getState().setSelectedElements({ type: 'floor', items: [{ containerId: 'c1', id: '10' }] });
    expect(useStore.getState().selectedElements?.type).toBe('floor');
    expect(useStore.getState().selectedElements?.items).toHaveLength(1);
  });

  it('toggleElement adds to same type', () => {
    useStore.getState().setSelectedElements({ type: 'voxel', items: [{ containerId: 'c1', id: '10' }] });
    useStore.getState().toggleElement('c1', '11');
    expect(useStore.getState().selectedElements?.items).toHaveLength(2);
  });

  it('toggleElement removes existing item', () => {
    useStore.getState().setSelectedElements({ type: 'voxel', items: [{ containerId: 'c1', id: '10' }, { containerId: 'c1', id: '11' }] });
    useStore.getState().toggleElement('c1', '10');
    expect(useStore.getState().selectedElements?.items).toHaveLength(1);
    expect(useStore.getState().selectedElements?.items[0].id).toBe('11');
  });

  it('setSelectedElements(null) clears selection', () => {
    useStore.getState().setSelectedElements({ type: 'voxel', items: [{ containerId: 'c1', id: '10' }] });
    useStore.getState().setSelectedElements(null);
    expect(useStore.getState().selectedElements).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/__tests__/selection-elements.test.ts`
Expected: FAIL — selectedElements not in store

- [ ] **Step 3: Add selectedElements to selectionSlice**

In `src/store/slices/selectionSlice.ts`:

Add `ElementType` type and `selectedElements` field + actions. **Keep the old fields temporarily** (don't remove yet) so the app doesn't break before call sites are migrated. Add the new fields alongside:

```ts
export type ElementType = 'frame' | 'wall' | 'floor' | 'ceiling' | 'voxel' | 'bay' | 'container';

// Add to interface:
selectedElements: {
  type: ElementType;
  items: Array<{ containerId: string; id: string }>;
} | null;
setSelectedElements: (sel: { type: ElementType; items: Array<{ containerId: string; id: string }> } | null) => void;
toggleElement: (containerId: string, id: string) => void;
```

Implementation:
```ts
selectedElements: null,
setSelectedElements: (sel) => set({ selectedElements: sel }),
toggleElement: (containerId, id) => set((s: any) => {
  const curr = s.selectedElements;
  if (!curr) return {};
  const idx = curr.items.findIndex((it: any) => it.containerId === containerId && it.id === id);
  if (idx >= 0) {
    const items = [...curr.items];
    items.splice(idx, 1);
    return { selectedElements: items.length > 0 ? { ...curr, items } : null };
  }
  return { selectedElements: { ...curr, items: [...curr.items, { containerId, id }] } };
}),
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/__tests__/selection-elements.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests still pass (old fields still present)

- [ ] **Step 6: Commit**

```bash
git add src/store/slices/selectionSlice.ts src/__tests__/selection-elements.test.ts
git commit -m "feat: add selectedElements typed selection context to selectionSlice"
```

---

## Task 19: Migrate Selection Call Sites (UI Components + Hooks)

**Files (complete inventory from grep):**
- Modify: `src/hooks/useSelectionTarget.ts` — rewrite derivation logic
- Modify: `src/components/ui/MatrixEditor.tsx` — 10 write call sites
- Modify: `src/components/ui/VoxelPreview3D.tsx` — 2 call sites
- Modify: `src/components/ui/SmartHotbar.tsx` — 2 call sites
- Modify: `src/components/ui/ContainerContextMenu.tsx` — 1 call site
- Modify: `src/components/ui/FaceStrip.tsx` — 2 call sites
- Modify: `src/components/ui/WarningPopover.tsx` — 4 call sites
- Modify: `src/components/ui/Sidebar.tsx` — selection reads + clearSelection call
- Modify: `src/components/ui/TopToolbar.tsx` — clearSelection call
- Modify: `src/components/ui/IsoEditor.tsx` — ~7 selection read references
- Modify: `src/components/ui/RecentItemsBar.tsx` — ~7 selection read references
- Modify: `src/components/ui/WallTypePicker.tsx` — ~5 selectedFace read references
- Modify: `src/components/ui/UserLibrary.tsx` — ~2 selection read references
- Modify: `src/components/ui/finishes/FinishesPanel.tsx` — ~10 selection read references
- Modify: `src/components/ui/finishes/SpatialVoxelGrid.tsx` — migrate from old fields to selectedElements
- Update test: `src/Testing/selection-target.test.ts` — update to verify hook with new model
- Update test: `src/Testing/selection-mutual-exclusion.test.ts`

**Migration patterns:**
- `selectedVoxel` reads → derive from `selectedElements?.type === 'voxel'`
- `selectedVoxels` reads → derive from `selectedElements?.type === 'bay'`
- `selectedFace` reads → derive from `selectedElements?.type === 'wall'|'floor'|'ceiling'`
- `clearSelection()` → `setSelectedElements(null)` (note: keep `clearSelection` as an alias action that calls `setSelectedElements(null)` to minimize changes)

- [ ] **Step 1: Update useSelectionTarget hook + test**

Rewrite `src/hooks/useSelectionTarget.ts` to derive from `selectedElements` instead of the old fields. Keep the same return shape (`SelectionTarget` union type) so downstream consumers don't break. Also update `src/Testing/selection-target.test.ts` to verify the hook produces correct output from `selectedElements`:

- `selectedElements.type === 'voxel'` → return `{ type: 'voxel', containerId, index: parseInt(id) }`
- `selectedElements.type === 'bay'` → return `{ type: 'bay', containerId, indices: bayGroupToIndices(id) }`
- `selectedElements.type === 'wall'` → return `{ type: 'face', containerId, index: parseInt(id.split(':')[0]), face: id.split(':')[1] }`
- etc.

- [ ] **Step 2: Migrate MatrixEditor call sites**

Read `src/components/ui/MatrixEditor.tsx`. Replace all 10 call sites:
- `setSelectedVoxel(...)` → `setSelectedElements({ type: 'voxel', items: [...] })`
- `setSelectedVoxels(...)` → `setSelectedElements({ type: 'bay', items: [...] })`
- `setSelectedFace(...)` → `setSelectedElements({ type: 'wall'/'floor'/'ceiling', items: [...] })`
- `toggleVoxelInSelection(...)` → `toggleElement(...)`

- [ ] **Step 3: Migrate remaining UI component call sites**

Update all remaining UI files using the same pattern:
- VoxelPreview3D (2 sites), SmartHotbar (2 sites), ContainerContextMenu (1 site), FaceStrip (2 sites), WarningPopover (4 sites)
- Sidebar (clearSelection → setSelectedElements(null)), TopToolbar (clearSelection)
- IsoEditor (~7 reads), RecentItemsBar (~7 reads), WallTypePicker (~5 reads), UserLibrary (~2 reads)
- FinishesPanel (~10 reads), SpatialVoxelGrid (migrate from old fields)

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/MatrixEditor.tsx src/components/ui/VoxelPreview3D.tsx src/components/ui/SmartHotbar.tsx src/components/ui/ContainerContextMenu.tsx src/components/ui/FaceStrip.tsx src/components/ui/WarningPopover.tsx src/hooks/useSelectionTarget.ts
git commit -m "feat: migrate UI component selection call sites to selectedElements"
```

---

## Task 20: Migrate Selection Call Sites (3D Components + Store Slices) + Remove Old Fields

**Files (3D components):**
- Modify: `src/components/objects/ContainerSkin.tsx` — 14 write call sites
- Modify: `src/components/three/ContainerMesh.tsx` — ~30 selection read references (CRITICAL — renders selection highlights)
- Modify: `src/components/three/BlueprintRenderer.tsx` — selection call sites
- Modify: `src/components/three/Scene.tsx` — selection call sites
- Modify: `src/components/three/SceneCanvas.tsx` — update onPointerMissed
- Modify: `src/components/three/FaceContextWidget.tsx` — ~8 selectedFace references

**Files (store slices):**
- Modify: `src/store/slices/selectionSlice.ts` — remove old fields
- Modify: `src/store/slices/containerSlice.ts` — 1 direct selectedVoxel write
- Modify: `src/store/slices/voxelSlice.ts` — ~2 selection references
- Modify: `src/store/containerStore.ts` — ~2 selection references

**Test files to update:**
- `src/__tests__/selection.test.ts` — rewrite to use selectedElements
- `src/__tests__/store-slices.test.ts` — update selection field references
- `src/__tests__/simple-mode-bugs.test.ts` — update selection references
- `src/__tests__/interactions.test.ts` — update selection references
- `src/__tests__/staircase-placement.test.ts` — update selection references
- `src/__tests__/persistence.test.ts` — update selection references
- `src/__tests__/undo.test.ts` — update selection references
- `src/__tests__/store-coverage.test.ts` — update selection references

- [ ] **Step 1: Migrate ContainerMesh (CRITICAL — selection highlight rendering)**

Read `src/components/three/ContainerMesh.tsx`. This has ~30 references to selection fields and is responsible for rendering the blue selection highlight on 3D voxels. All reads of `selectedVoxel`/`selectedVoxels`/`selectedFace` must be replaced with reads from `selectedElements`. This is the highest-risk file — test thoroughly after migration.

- [ ] **Step 2: Migrate ContainerSkin call sites**

Read the 14 call sites in ContainerSkin.tsx. Each `setSelectedVoxel`, `setSelectedVoxels`, `setSelectedFace` call via `useStore.getState()` must be replaced with `setSelectedElements(...)`. Many of these are in click handlers inside `useMemo` or event callbacks.

Key patterns:
- `storeNow.setSelectedVoxel({ containerId: container.id, index: voxelIndex })` → `storeNow.setSelectedElements({ type: 'voxel', items: [{ containerId: container.id, id: String(voxelIndex) }] })`
- `useStore.getState().setSelectedVoxels({ containerId: container.id, indices: bayIndices })` → `useStore.getState().setSelectedElements({ type: 'bay', items: bayIndices.map(i => ({ containerId: container.id, id: 'bay' + bayIdFromIndex(i) })) })`
- `useStore.getState().setSelectedFace(faceName)` → update the selectedElements items to include face info

- [ ] **Step 3: Migrate remaining 3D components and store slices**

- BlueprintRenderer.tsx, Scene.tsx — update write call sites
- FaceContextWidget.tsx — update ~8 selectedFace reads
- SceneCanvas.tsx — update onPointerMissed clears
- containerSlice.ts — update 1 direct selectedVoxel write
- voxelSlice.ts, containerStore.ts — update selection references

- [ ] **Step 4: Update all test files**

Update 8 test files listed above. For each: replace `selectedVoxel`/`selectedVoxels`/`selectedFace` references with `selectedElements` equivalents. Some tests will need `setSelectedElements(...)` instead of the old setters. Run each test file individually to verify.

- [ ] **Step 5: Remove old fields from selectionSlice**

Remove from interface and implementation:
- `selectedVoxel`, `setSelectedVoxel`
- `selectedVoxels`, `setSelectedVoxels`
- `selectedFace`, `setSelectedFace`
- `toggleVoxelInSelection`

Keep `clearSelection()` as an alias that calls `setSelectedElements(null)` to minimize breakage.

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors — all references migrated

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (307+ tests). All selection test files should have been updated in Step 4.

- [ ] **Step 8: Browser verify**

Full browser walkthrough:
- Click a voxel → selected (blue highlight)
- Click a face in VoxelPreview3D → face selected
- Click a bay in MatrixEditor → bay selected
- Click in empty space → selection clears
- Block tab presets still apply correctly
- Undo/redo still works

- [ ] **Step 9: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx src/components/three/ContainerMesh.tsx src/components/three/BlueprintRenderer.tsx src/components/three/Scene.tsx src/components/three/SceneCanvas.tsx src/components/three/FaceContextWidget.tsx src/store/slices/selectionSlice.ts src/store/slices/containerSlice.ts src/store/slices/voxelSlice.ts src/store/containerStore.ts src/__tests__/selection.test.ts src/__tests__/store-slices.test.ts src/__tests__/simple-mode-bugs.test.ts src/__tests__/interactions.test.ts src/__tests__/staircase-placement.test.ts src/__tests__/persistence.test.ts src/__tests__/undo.test.ts src/__tests__/store-coverage.test.ts
git commit -m "feat: complete selection model migration — 3D components, store slices, tests"
```

---

## Task 21: Multi-Select Interaction (Shift+Click, Ctrl+Click)

**Files:**
- Modify: `src/components/ui/finishes/SpatialVoxelGrid.tsx`
- Modify: `src/components/ui/MatrixEditor.tsx`

- [ ] **Step 1: Add keyboard modifier detection to SpatialVoxelGrid**

In cell click handlers, detect `event.shiftKey` and `event.ctrlKey` (or `event.metaKey` for Mac). **Enforce mode gating**: check `frameMode` and `inspectorView` before allowing selection. If Frame ON, only allow `type: 'frame'`. If Frame OFF + Floor mode, allow floor/wall/bay/voxel/container. If Frame OFF + Ceiling mode, allow ceiling/wall/bay/voxel/container. Reject incompatible types silently:

```tsx
const handleCellClick = (e: React.MouseEvent, cellId: string, containerId: string) => {
  const { selectedElements, setSelectedElements, toggleElement } = useStore.getState();

  if (e.ctrlKey || e.metaKey) {
    // Ctrl+Click: toggle element in current type
    if (!selectedElements || selectedElements.type === cellType) {
      toggleElement(containerId, cellId);
    } else {
      // Different type: clear and start new
      setSelectedElements({ type: cellType, items: [{ containerId, id: cellId }] });
    }
  } else if (e.shiftKey && selectedElements && selectedElements.items.length > 0) {
    // Shift+Click: range select (row-major order)
    const rangeItems = computeRange(lastSelected, cellId, cellType);
    setSelectedElements({ type: cellType, items: rangeItems });
  } else {
    // Plain click: single select
    setSelectedElements({ type: cellType, items: [{ containerId, id: cellId }] });
  }
};
```

- [ ] **Step 2: Add Shift-hover range preview styling**

When `shiftKey` is held and hovering, show dashed border on cells that would be selected in the range.

- [ ] **Step 3: Add visual feedback styles**

Apply the multi-select visual feedback from the spec:
- Single selected: `2px solid var(--accent)`, filled bg
- Multi-selected: `2px solid var(--accent-muted)`, filled bg
- Shift-hover range: `1px dashed var(--accent)`, no fill

- [ ] **Step 4: Browser verify**

Test in browser:
- Click Bay 1 → selected
- Ctrl+Click Bay 2 → both selected
- Ctrl+Click Bay 1 → deselected, only Bay 2 remains
- Shift+Click Bay 3 (with Bay 1 selected) → Bay 1, 2, 3 all selected
- Click a floor face when walls selected → walls clear, floor selected

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/finishes/SpatialVoxelGrid.tsx src/components/ui/MatrixEditor.tsx
git commit -m "feat: add multi-select with Shift+Click range and Ctrl+Click toggle"
```

---

## Task 22: Final Type Check + Full Test Suite

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (307+ tests)

- [ ] **Step 3: Run acceptance gates**

Run: `npm run gates`
Expected: All gates pass

- [ ] **Step 4: Full browser walkthrough**

Verify all 6 design pass changes:
1. ✅ PresetCard with isometric SVGs across Block, Electrical, Flooring, Walls, Ceiling tabs
2. ✅ Container tab with mode toggles, preset row, spatial grid
3. ✅ Ghost preview on hover (block and container presets)
4. ✅ Inspector cleanup (single toggle icon, no legend/cable/scope)
5. ✅ Hotbar responsive offset + transparency + readable labels
6. ✅ Multi-select with Shift+Click and Ctrl+Click

- [ ] **Step 5: Final commit (if any uncommitted fixes)**

```bash
git add src/
git commit -m "chore: design pass final fixes from verification walkthrough"
```
