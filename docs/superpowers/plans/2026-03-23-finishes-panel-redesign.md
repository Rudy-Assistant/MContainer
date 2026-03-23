# FinishesPanel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat conditional FinishesPanel with a tabbed layout driven by VoxelPreview3D as the face selector, with texture thumbnail swatches and Open-wall empty-state fix.

**Architecture:** New `src/components/ui/finishes/` directory with thin shell + 4 tab files + 3 shared primitives. VoxelPreview3D (already built) becomes the face selector at the top of the panel. Each tab reads voxel data from the store via atomic selectors. Sidebar routing merges the voxel/face branches into one FinishesPanel route.

**Tech Stack:** React 19, TypeScript, Zustand v5, Next.js 16, existing PBR texture assets in `/public/assets/materials/`

**Spec:** `docs/superpowers/specs/2026-03-23-finishes-panel-redesign-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/container.ts` | Modify | Add `color?: string` to `FaceFinish` |
| `src/config/finishPresets.ts` | Modify | Add `textureFolder?: string` to `MaterialPreset`, add mappings |
| `src/components/ui/finishes/textureThumbnail.ts` | Create | Thumbnail URL resolver + canvas noise fallback |
| `src/components/ui/finishes/SwatchRow.tsx` | Create | Extracted color circle row + custom picker |
| `src/components/ui/finishes/OptionCardGrid.tsx` | Create | Grid for non-texture items (fixtures, doors, electrical) |
| `src/components/ui/finishes/TextureSwatchGrid.tsx` | Create | 3-col grid of 64×64 texture swatches |
| `src/components/ui/finishes/FinishesTabBar.tsx` | Create | Horizontal tab pill buttons |
| `src/components/ui/finishes/FlooringTab.tsx` | Create | Floor material grid + Color |
| `src/components/ui/finishes/WallsTab.tsx` | Create | Surface type picker + surface-dependent finishes + Color |
| `src/components/ui/finishes/CeilingTab.tsx` | Create | Ceiling material + lighting + Color |
| `src/components/ui/finishes/ElectricalTab.tsx` | Create | Switches/outlets/dimmers + Color |
| `src/components/ui/finishes/FinishesPanel.tsx` | Create | Shell: VoxelPreview3D + tab state + auto-select + active tab |
| `src/components/ui/VoxelPreview3D.tsx` | Modify | Face click → `setSelectedFace` instead of surface cycle |
| `src/components/ui/Sidebar.tsx` | Modify | Merge voxel/face routes into single FinishesPanel |
| `src/__tests__/finishes-panel.test.ts` | Create | Tests for tab auto-select, swatch grid, wall empty state |

---

### Task 1: Data Model — Add `color` to FaceFinish and `textureFolder` to MaterialPreset

**Files:**
- Modify: `src/types/container.ts:343-352`
- Modify: `src/config/finishPresets.ts:3-8, 15-20, 82-95`

- [ ] **Step 1: Add `color` field to `FaceFinish`**

In `src/types/container.ts`, add `color?: string` to the `FaceFinish` interface:

```ts
export interface FaceFinish {
  material?: string;
  paint?: string;
  tint?: string;
  frameColor?: string;
  doorStyle?: string;
  light?: string;
  lightColor?: string;
  electrical?: string;
  color?: string;  // universal tint — applied on every face category
}
```

- [ ] **Step 2: Add `textureFolder` to `MaterialPreset` and add mappings**

In `src/config/finishPresets.ts`, extend `MaterialPreset`:

```ts
export interface MaterialPreset {
  id: string;
  label: string;
  color: string;
  icon?: string;
  textureFolder?: string;  // maps to /assets/materials/{folder}/color.jpg
}
```

Then add `textureFolder` to the preset arrays:

```ts
export const EXTERIOR_MATERIALS: MaterialPreset[] = [
  { id: 'steel',    label: 'Steel',    color: '#708090', textureFolder: 'Corrugated_Steel' },
  { id: 'wood',     label: 'Wood',     color: '#8B7355', textureFolder: 'Deck_Wood' },
  { id: 'concrete', label: 'Concrete', color: '#A9A9A9', textureFolder: 'Concrete' },
  { id: 'bamboo',   label: 'Bamboo',   color: '#D4B896', textureFolder: 'Bamboo' },
];

export const FLOOR_MATERIALS: MaterialPreset[] = [
  { id: 'oak_wood',    label: 'Oak Planks',        color: '#A0785A', textureFolder: 'Deck_Wood' },
  { id: 'concrete',    label: 'Polished Concrete',  color: '#A9A9A9', textureFolder: 'Concrete' },
  { id: 'bamboo',      label: 'Bamboo',             color: '#D4B896', textureFolder: 'Bamboo' },
  { id: 'hinoki',      label: 'Hinoki Cedar',       color: '#F5E6C8', textureFolder: 'Japanese_Cedar' },
  { id: 'tatami',      label: 'Tatami',             color: '#C8D5A0' },
  { id: 'tile',        label: 'Tile',               color: '#E0D5C5' },
];

export const CEILING_MATERIALS: MaterialPreset[] = [
  { id: 'steel',   label: 'Steel',   color: '#708090', textureFolder: 'Corrugated_Steel' },
  { id: 'open',    label: 'Open',    color: '#333333' },
  { id: 'plaster', label: 'Plaster', color: '#F5F5F5', textureFolder: 'Plaster' },
];
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass (adding optional fields is backward-compatible)

- [ ] **Step 5: Commit**

```bash
git add src/types/container.ts src/config/finishPresets.ts
git commit -m "feat: add color field to FaceFinish and textureFolder to MaterialPreset"
```

---

### Task 2: Shared Primitives — textureThumbnail, SwatchRow, OptionCardGrid

**Files:**
- Create: `src/components/ui/finishes/textureThumbnail.ts`
- Create: `src/components/ui/finishes/SwatchRow.tsx`
- Create: `src/components/ui/finishes/OptionCardGrid.tsx`
- Create: `src/__tests__/finishes-panel.test.ts`

- [ ] **Step 1: Write tests for textureThumbnail**

Create `src/__tests__/finishes-panel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getSwatchSrc, generateNoiseSwatch } from '@/components/ui/finishes/textureThumbnail';

describe('textureThumbnail', () => {
  it('returns texture URL when textureFolder is provided', () => {
    const src = getSwatchSrc({ id: 'bamboo', label: 'Bamboo', color: '#D4B896', textureFolder: 'Bamboo' });
    expect(src).toBe('/assets/materials/Bamboo/color.jpg');
  });

  it('returns null when no textureFolder', () => {
    const src = getSwatchSrc({ id: 'tatami', label: 'Tatami', color: '#C8D5A0' });
    expect(src).toBeNull();
  });

  it('generates a data URL for noise swatch', () => {
    const dataUrl = generateNoiseSwatch('test', '#FF0000', 4);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('caches generated swatches by id', () => {
    const a = generateNoiseSwatch('cache-test', '#00FF00', 4);
    const b = generateNoiseSwatch('cache-test', '#00FF00', 4);
    expect(a).toBe(b); // same reference from cache
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/finishes-panel.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create textureThumbnail.ts**

Create `src/components/ui/finishes/textureThumbnail.ts`:

```ts
export interface SwatchItem {
  id: string;
  label: string;
  color: string;
  textureFolder?: string;
}

/** Returns the runtime URL for a texture thumbnail, or null if no texture folder */
export function getSwatchSrc(item: SwatchItem): string | null {
  if (!item.textureFolder) return null;
  return `/assets/materials/${item.textureFolder}/color.jpg`;
}

const _cache = new Map<string, string>();

/** Generate a canvas data URL with noise pattern from a hex color. Cached by id. */
export function generateNoiseSwatch(id: string, hex: string, size = 64): string {
  const cached = _cache.get(id);
  if (cached) return cached;

  const canvas = typeof document !== 'undefined'
    ? document.createElement('canvas')
    : { width: size, height: size, getContext: () => null, toDataURL: () => '' } as unknown as HTMLCanvasElement;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = `data:image/png;base64,`;
    _cache.set(id, fallback);
    return fallback;
  }

  // Parse hex
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const imageData = ctx.createImageData(size, size);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const noise = Math.random() * 20 - 10;
    d[i]     = Math.max(0, Math.min(255, r + noise));
    d[i + 1] = Math.max(0, Math.min(255, g + noise));
    d[i + 2] = Math.max(0, Math.min(255, b + noise));
    d[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const dataUrl = canvas.toDataURL('image/png');
  _cache.set(id, dataUrl);
  return dataUrl;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/finishes-panel.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: Create SwatchRow.tsx**

Create `src/components/ui/finishes/SwatchRow.tsx` — extracted from old FinishesPanel:

```tsx
"use client";

import { useState } from 'react';
import type { ColorPreset } from '@/config/finishPresets';
import ColorPicker from '@/components/ui/ColorPicker';

interface Props {
  colors: ColorPreset[];
  activeHex?: string;
  onSelect: (hex: string, label: string) => void;
  label: string;
}

export default function SwatchRow({ colors, activeHex, onSelect, label }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        color: 'var(--text-dim, #64748b)', letterSpacing: '0.05em', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {colors.map((c) => (
          <button
            key={c.hex}
            onClick={() => onSelect(c.hex, c.label)}
            title={c.label}
            style={{
              width: 24, height: 24, borderRadius: 4, cursor: 'pointer', background: c.hex,
              border: `2px solid ${activeHex === c.hex ? 'var(--accent, #3b82f6)' : 'rgba(0,0,0,0.15)'}`,
              padding: 0,
            }}
          />
        ))}
        <button
          onClick={() => setShowPicker(!showPicker)}
          title="Custom color"
          style={{
            width: 24, height: 24, borderRadius: 4, cursor: 'pointer',
            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            border: '2px solid var(--border-dark, #334155)', padding: 0,
            fontSize: 12, color: '#fff', fontWeight: 700, textShadow: '0 0 2px rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>
      {showPicker && (
        <ColorPicker
          color={activeHex || '#FFFFFF'}
          onChange={(hex) => onSelect(hex, 'Custom')}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create OptionCardGrid.tsx**

Create `src/components/ui/finishes/OptionCardGrid.tsx`:

```tsx
"use client";

import type { MaterialPreset } from '@/config/finishPresets';

interface Props {
  items: MaterialPreset[];
  activeId?: string;
  onSelect: (id: string, label: string) => void;
  label: string;
}

export default function OptionCardGrid({ items, activeId, onSelect, label }: Props) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        color: 'var(--text-dim, #64748b)', letterSpacing: '0.05em', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id, item.label)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '8px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 9,
              border: `2px solid ${activeId === item.id ? 'var(--accent, #3b82f6)' : 'var(--border-dark, #334155)'}`,
              background: activeId === item.id ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'var(--card-dark, #1e293b)',
              color: 'var(--text-main, #e2e8f0)', transition: 'border-color 100ms',
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: item.color, border: '1px solid rgba(255,255,255,0.1)',
            }} />
            {item.icon && <span style={{ fontSize: 16 }}>{item.icon}</span>}
            <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/finishes/textureThumbnail.ts src/components/ui/finishes/SwatchRow.tsx src/components/ui/finishes/OptionCardGrid.tsx src/__tests__/finishes-panel.test.ts
git commit -m "feat: add shared finishes primitives — textureThumbnail, SwatchRow, OptionCardGrid"
```

---

### Task 3: TextureSwatchGrid Component

**Files:**
- Create: `src/components/ui/finishes/TextureSwatchGrid.tsx`
- Modify: `src/__tests__/finishes-panel.test.ts`

- [ ] **Step 1: Add tests for TextureSwatchGrid**

Append to `src/__tests__/finishes-panel.test.ts`:

```ts
import { FLOOR_MATERIALS } from '@/config/finishPresets';
import { getSwatchSrc } from '@/components/ui/finishes/textureThumbnail';

describe('TextureSwatchGrid data integration', () => {
  it('FLOOR_MATERIALS with textureFolder resolve to valid paths', () => {
    const withTexture = FLOOR_MATERIALS.filter(m => m.textureFolder);
    expect(withTexture.length).toBeGreaterThanOrEqual(4);
    for (const m of withTexture) {
      const src = getSwatchSrc(m);
      expect(src).toMatch(/^\/assets\/materials\/.+\/color\.jpg$/);
    }
  });

  it('FLOOR_MATERIALS without textureFolder have fallback color', () => {
    const noTexture = FLOOR_MATERIALS.filter(m => !m.textureFolder);
    for (const m of noTexture) {
      expect(m.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (data-only test, no component)

Run: `npx vitest run src/__tests__/finishes-panel.test.ts`
Expected: New tests pass (they test data, not rendering)

- [ ] **Step 3: Create TextureSwatchGrid.tsx**

Create `src/components/ui/finishes/TextureSwatchGrid.tsx`:

```tsx
"use client";

import { useState, useCallback } from 'react';
import type { MaterialPreset } from '@/config/finishPresets';
import { getSwatchSrc, generateNoiseSwatch } from './textureThumbnail';

interface Props {
  items: MaterialPreset[];
  activeId?: string;
  onSelect: (id: string, label: string) => void;
  label: string;
}

export default function TextureSwatchGrid({ items, activeId, onSelect, label }: Props) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        color: 'var(--text-dim, #64748b)', letterSpacing: '0.05em', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {items.map((item) => (
          <SwatchButton key={item.id} item={item} active={activeId === item.id} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function SwatchButton({ item, active, onSelect }: {
  item: MaterialPreset; active: boolean; onSelect: (id: string, label: string) => void;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const textureSrc = getSwatchSrc(item);
  const fallbackSrc = generateNoiseSwatch(item.id, item.color);

  const handleError = useCallback(() => setUseFallback(true), []);

  const imgSrc = (textureSrc && !useFallback) ? textureSrc : fallbackSrc;

  return (
    <button
      onClick={() => onSelect(item.id, item.label)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: 4, borderRadius: 6, cursor: 'pointer',
        border: `2px solid ${active ? 'var(--accent, #3b82f6)' : 'var(--border-dark, #334155)'}`,
        background: active ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'var(--card-dark, #1e293b)',
        transition: 'border-color 100ms',
      }}
    >
      <img
        src={imgSrc}
        alt={item.label}
        loading="lazy"
        onError={textureSrc ? handleError : undefined}
        style={{
          width: 64, height: 64, borderRadius: 4,
          objectFit: 'cover', display: 'block',
        }}
      />
      <span style={{
        fontSize: 9, textTransform: 'uppercase', color: 'var(--text-dim, #64748b)',
        lineHeight: 1.2, textAlign: 'center',
      }}>
        {item.label}
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/finishes/TextureSwatchGrid.tsx src/__tests__/finishes-panel.test.ts
git commit -m "feat: add TextureSwatchGrid with PBR crop and canvas noise fallback"
```

---

### Task 4: FinishesTabBar Component

**Files:**
- Create: `src/components/ui/finishes/FinishesTabBar.tsx`
- Modify: `src/__tests__/finishes-panel.test.ts`

- [ ] **Step 1: Add tab auto-selection tests**

Append to `src/__tests__/finishes-panel.test.ts`:

```ts
describe('tab auto-selection logic', () => {
  // Pure function extracted for testability
  function faceToTab(face: string | null): 'flooring' | 'walls' | 'ceiling' | 'electrical' | null {
    if (face === 'bottom') return 'flooring';
    if (face === 'top') return 'ceiling';
    if (face === 'n' || face === 's' || face === 'e' || face === 'w') return 'walls';
    return null;
  }

  it('maps bottom to flooring', () => expect(faceToTab('bottom')).toBe('flooring'));
  it('maps top to ceiling', () => expect(faceToTab('top')).toBe('ceiling'));
  it('maps n to walls', () => expect(faceToTab('n')).toBe('walls'));
  it('maps s to walls', () => expect(faceToTab('s')).toBe('walls'));
  it('maps e to walls', () => expect(faceToTab('e')).toBe('walls'));
  it('maps w to walls', () => expect(faceToTab('w')).toBe('walls'));
  it('maps null to null', () => expect(faceToTab(null)).toBeNull());
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/__tests__/finishes-panel.test.ts`
Expected: All new tests pass (pure function, no imports needed)

- [ ] **Step 3: Create FinishesTabBar.tsx**

Create `src/components/ui/finishes/FinishesTabBar.tsx`:

```tsx
"use client";

export type FinishTab = 'flooring' | 'walls' | 'ceiling' | 'electrical';

export const FINISH_TABS: { id: FinishTab; label: string }[] = [
  { id: 'flooring', label: 'Flooring' },
  { id: 'walls', label: 'Walls' },
  { id: 'ceiling', label: 'Ceiling' },
  { id: 'electrical', label: 'Electrical' },
];

/** Maps a face key to the appropriate tab */
export function faceToTab(face: string | null): FinishTab | null {
  if (face === 'bottom') return 'flooring';
  if (face === 'top') return 'ceiling';
  if (face === 'n' || face === 's' || face === 'e' || face === 'w') return 'walls';
  return null;
}

interface Props {
  activeTab: FinishTab;
  onTabChange: (tab: FinishTab) => void;
  disabled?: boolean;
}

export default function FinishesTabBar({ activeTab, onTabChange, disabled }: Props) {
  return (
    <div style={{
      display: 'flex', gap: 2, padding: '4px 8px',
      borderBottom: '1px solid var(--border-dark, #334155)',
    }}>
      {FINISH_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !disabled && onTabChange(tab.id)}
          style={{
            flex: 1, padding: '6px 4px', fontSize: 10, fontWeight: 600,
            borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
            border: activeTab === tab.id
              ? '1px solid var(--accent, #3b82f6)'
              : '1px solid transparent',
            background: activeTab === tab.id
              ? 'var(--accent-bg, rgba(59,130,246,0.08))'
              : 'transparent',
            color: disabled
              ? 'var(--text-dim, #475569)'
              : activeTab === tab.id
                ? 'var(--accent, #3b82f6)'
                : 'var(--text-main, #e2e8f0)',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 100ms',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Update test to import from FinishesTabBar**

Replace the inline `faceToTab` in the test with the real import:

```ts
import { faceToTab } from '@/components/ui/finishes/FinishesTabBar';

describe('tab auto-selection logic', () => {
  it('maps bottom to flooring', () => expect(faceToTab('bottom')).toBe('flooring'));
  it('maps top to ceiling', () => expect(faceToTab('top')).toBe('ceiling'));
  it('maps n to walls', () => expect(faceToTab('n')).toBe('walls'));
  it('maps s to walls', () => expect(faceToTab('s')).toBe('walls'));
  it('maps e to walls', () => expect(faceToTab('e')).toBe('walls'));
  it('maps w to walls', () => expect(faceToTab('w')).toBe('walls'));
  it('maps null to null', () => expect(faceToTab(null)).toBeNull());
});
```

- [ ] **Step 5: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run src/__tests__/finishes-panel.test.ts`
Expected: 0 errors, all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/finishes/FinishesTabBar.tsx src/__tests__/finishes-panel.test.ts
git commit -m "feat: add FinishesTabBar with face-to-tab auto-selection"
```

---

### Task 5: Tab Content Components — FlooringTab, CeilingTab, ElectricalTab

**Files:**
- Create: `src/components/ui/finishes/FlooringTab.tsx`
- Create: `src/components/ui/finishes/CeilingTab.tsx`
- Create: `src/components/ui/finishes/ElectricalTab.tsx`

- [ ] **Step 1: Create FlooringTab.tsx**

Create `src/components/ui/finishes/FlooringTab.tsx`:

```tsx
"use client";

import { useStore } from '@/store/useStore';
import { FLOOR_MATERIALS, PAINT_COLORS } from '@/config/finishPresets';
import type { FaceFinish } from '@/types/container';
import type { FaceKey } from '@/hooks/useSelectionTarget';
import TextureSwatchGrid from './TextureSwatchGrid';
import SwatchRow from './SwatchRow';

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
}

export default function FlooringTab({ containerId, voxelIndex, indices, face }: Props) {
  const currentFinish = useStore((s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]);
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  const addRecentItem = useStore((s) => s.addRecentItem);

  const applyFinish = (patch: Partial<FaceFinish>) => {
    for (const idx of indices) setFaceFinish(containerId, idx, face, patch);
  };

  return (
    <div style={{ padding: '8px 12px' }}>
      <TextureSwatchGrid
        label="Flooring Material"
        items={FLOOR_MATERIALS}
        activeId={currentFinish?.material}
        onSelect={(id, label) => {
          applyFinish({ material: id });
          addRecentItem({ type: 'finish', value: `floor:${id}`, label });
        }}
      />
      <SwatchRow
        label="Color"
        colors={PAINT_COLORS}
        activeHex={currentFinish?.color}
        onSelect={(hex, label) => {
          applyFinish({ color: hex });
          addRecentItem({ type: 'finish', value: `color:${hex}`, label });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create CeilingTab.tsx**

Create `src/components/ui/finishes/CeilingTab.tsx`:

```tsx
"use client";

import { useStore } from '@/store/useStore';
import { CEILING_MATERIALS, LIGHT_FIXTURES, LIGHT_COLORS, PAINT_COLORS } from '@/config/finishPresets';
import type { FaceFinish } from '@/types/container';
import type { FaceKey } from '@/hooks/useSelectionTarget';
import TextureSwatchGrid from './TextureSwatchGrid';
import OptionCardGrid from './OptionCardGrid';
import SwatchRow from './SwatchRow';

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
}

export default function CeilingTab({ containerId, voxelIndex, indices, face }: Props) {
  const currentFinish = useStore((s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]);
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  const addRecentItem = useStore((s) => s.addRecentItem);

  const applyFinish = (patch: Partial<FaceFinish>) => {
    for (const idx of indices) setFaceFinish(containerId, idx, face, patch);
  };

  return (
    <div style={{ padding: '8px 12px' }}>
      <TextureSwatchGrid
        label="Ceiling Material"
        items={CEILING_MATERIALS}
        activeId={currentFinish?.material}
        onSelect={(id, label) => {
          applyFinish({ material: id });
          addRecentItem({ type: 'finish', value: `ceil:${id}`, label });
        }}
      />
      <OptionCardGrid
        label="Lighting"
        items={LIGHT_FIXTURES}
        activeId={currentFinish?.light || 'none'}
        onSelect={(id, label) => {
          applyFinish({ light: id });
          addRecentItem({ type: 'finish', value: `light:${id}`, label });
        }}
      />
      {currentFinish?.light && currentFinish.light !== 'none' && (
        <OptionCardGrid
          label="Light Color"
          items={LIGHT_COLORS}
          activeId={currentFinish?.lightColor || 'warm'}
          onSelect={(id) => applyFinish({ lightColor: id })}
        />
      )}
      <SwatchRow
        label="Color"
        colors={PAINT_COLORS}
        activeHex={currentFinish?.color}
        onSelect={(hex, label) => {
          applyFinish({ color: hex });
          addRecentItem({ type: 'finish', value: `color:${hex}`, label });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create ElectricalTab.tsx**

Create `src/components/ui/finishes/ElectricalTab.tsx`:

```tsx
"use client";

import { useStore } from '@/store/useStore';
import { ELECTRICAL_TYPES, PAINT_COLORS } from '@/config/finishPresets';
import type { FaceFinish } from '@/types/container';
import type { FaceKey } from '@/hooks/useSelectionTarget';
import OptionCardGrid from './OptionCardGrid';
import SwatchRow from './SwatchRow';

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
}

export default function ElectricalTab({ containerId, voxelIndex, indices, face }: Props) {
  // Hooks must be called unconditionally (Rules of Hooks)
  const currentFinish = useStore((s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]);
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  const addRecentItem = useStore((s) => s.addRecentItem);

  const isWallFace = face !== 'top' && face !== 'bottom';

  if (!isWallFace) {
    return (
      <div style={{ padding: '16px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim, #64748b)' }}>
          Electrical is available on wall faces. Click a wall in the preview above.
        </div>
      </div>
    );
  }

  const applyFinish = (patch: Partial<FaceFinish>) => {
    for (const idx of indices) setFaceFinish(containerId, idx, face, patch);
  };

  return (
    <div style={{ padding: '8px 12px' }}>
      <OptionCardGrid
        label="Electrical"
        items={ELECTRICAL_TYPES}
        activeId={currentFinish?.electrical || 'none'}
        onSelect={(id, label) => {
          applyFinish({ electrical: id });
          addRecentItem({ type: 'finish', value: `elec:${id}`, label });
        }}
      />
      <SwatchRow
        label="Color"
        colors={PAINT_COLORS}
        activeHex={currentFinish?.color}
        onSelect={(hex, label) => {
          applyFinish({ color: hex });
          addRecentItem({ type: 'finish', value: `color:${hex}`, label });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/finishes/FlooringTab.tsx src/components/ui/finishes/CeilingTab.tsx src/components/ui/finishes/ElectricalTab.tsx
git commit -m "feat: add FlooringTab, CeilingTab, ElectricalTab content components"
```

---

### Task 6: WallsTab — Surface Type Picker + Open Wall Fix

**Files:**
- Create: `src/components/ui/finishes/WallsTab.tsx`
- Modify: `src/__tests__/finishes-panel.test.ts`

- [ ] **Step 1: Add Open wall test**

Append to `src/__tests__/finishes-panel.test.ts`:

```ts
import { getFinishOptionsForFace } from '@/config/finishPresets';

describe('Open wall empty-state', () => {
  it('getFinishOptionsForFace returns all false for Open wall', () => {
    const opts = getFinishOptionsForFace('Open', 'n');
    const allFalse = Object.values(opts).every(v => v === false);
    expect(allFalse).toBe(true);
  });

  it('getFinishOptionsForFace returns true flags for Solid_Steel wall', () => {
    const opts = getFinishOptionsForFace('Solid_Steel', 'n');
    expect(opts.exteriorMaterial).toBe(true);
    expect(opts.electrical).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/__tests__/finishes-panel.test.ts`
Expected: Pass — validates the data behavior the WallsTab depends on

- [ ] **Step 3: Create WallsTab.tsx**

Create `src/components/ui/finishes/WallsTab.tsx`:

```tsx
"use client";

import { useStore } from '@/store/useStore';
import {
  EXTERIOR_MATERIALS, GLASS_TINTS, FRAME_COLORS, DOOR_STYLES, PAINT_COLORS,
  getFinishOptionsForFace,
} from '@/config/finishPresets';
import { getWallTypesForContext } from '@/config/wallTypes';
import type { SurfaceType, FaceFinish } from '@/types/container';
import type { FaceKey } from '@/hooks/useSelectionTarget';
import TextureSwatchGrid from './TextureSwatchGrid';
import OptionCardGrid from './OptionCardGrid';
import SwatchRow from './SwatchRow';

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
}

export default function WallsTab({ containerId, voxelIndex, indices, face }: Props) {
  const surface = useStore((s) =>
    s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faces[face] as SurfaceType | undefined
  );
  const currentFinish = useStore((s) =>
    s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]
  );
  const inspectorView = useStore((s) => s.inspectorView);
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  const paintFace = useStore((s) => s.paintFace);
  const addRecentItem = useStore((s) => s.addRecentItem);

  const wallTypes = getWallTypesForContext(inspectorView, face);

  const handleSurfaceChange = (newSurface: SurfaceType) => {
    for (const idx of indices) paintFace(containerId, idx, face, newSurface);
    addRecentItem({ type: 'wallType', value: newSurface, label: newSurface.replace(/_/g, ' ') });
  };

  const applyFinish = (patch: Partial<FaceFinish>) => {
    for (const idx of indices) setFaceFinish(containerId, idx, face, patch);
  };

  const opts = surface ? getFinishOptionsForFace(surface, face) : null;

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Surface type picker — always visible */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          color: 'var(--text-dim, #64748b)', letterSpacing: '0.05em', marginBottom: 6,
        }}>
          Wall Surface
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {wallTypes.map((entry) => (
            <button
              key={entry.surface + '-' + entry.category}
              onClick={() => handleSurfaceChange(entry.surface)}
              title={entry.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 9,
                border: `2px solid ${surface === entry.surface ? 'var(--accent, #3b82f6)' : 'var(--border-dark, #334155)'}`,
                background: surface === entry.surface ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'var(--card-dark, #1e293b)',
                color: 'var(--text-main, #e2e8f0)', transition: 'border-color 100ms',
              }}
            >
              <span style={{ fontSize: 16 }}>{entry.icon}</span>
              <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{entry.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Surface-dependent finishes — only when surface is not Open */}
      {opts?.exteriorMaterial && (
        <TextureSwatchGrid
          label="Exterior Material"
          items={EXTERIOR_MATERIALS}
          activeId={currentFinish?.material}
          onSelect={(id, label) => {
            applyFinish({ material: id });
            addRecentItem({ type: 'finish', value: `material:${id}`, label });
          }}
        />
      )}

      {opts?.glassTint && (
        <SwatchRow
          label="Glass Tint"
          colors={GLASS_TINTS}
          activeHex={currentFinish?.tint}
          onSelect={(hex, label) => {
            applyFinish({ tint: hex });
            addRecentItem({ type: 'finish', value: `tint:${hex}`, label });
          }}
        />
      )}

      {opts?.frameColor && (
        <SwatchRow
          label="Frame Color"
          colors={FRAME_COLORS}
          activeHex={currentFinish?.frameColor}
          onSelect={(hex, label) => {
            applyFinish({ frameColor: hex });
            addRecentItem({ type: 'finish', value: `frame:${hex}`, label });
          }}
        />
      )}

      {opts?.doorStyle && (
        <OptionCardGrid
          label="Door Style"
          items={DOOR_STYLES}
          activeId={currentFinish?.doorStyle}
          onSelect={(id, label) => {
            applyFinish({ doorStyle: id });
            addRecentItem({ type: 'finish', value: `door:${id}`, label });
          }}
        />
      )}

      {/* Color — universal, shown for any non-Open surface */}
      {surface && surface !== 'Open' && (
        <SwatchRow
          label="Color"
          colors={PAINT_COLORS}
          activeHex={currentFinish?.color}
          onSelect={(hex, label) => {
            applyFinish({ color: hex });
            addRecentItem({ type: 'finish', value: `color:${hex}`, label });
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run src/__tests__/finishes-panel.test.ts`
Expected: 0 errors, all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/finishes/WallsTab.tsx src/__tests__/finishes-panel.test.ts
git commit -m "feat: add WallsTab with surface type picker and Open wall fix"
```

---

### Task 7: VoxelPreview3D — Wire Face Click to setSelectedFace

**Files:**
- Modify: `src/components/ui/VoxelPreview3D.tsx:258-430`

- [ ] **Step 1: Add setSelectedFace to CubeScene**

In `src/components/ui/VoxelPreview3D.tsx`, inside the `CubeScene` function (around line 266), add the selector:

```ts
const setSelectedFace = useStore((s) => s.setSelectedFace);
```

- [ ] **Step 2: Change the onCycle callback in the faceConfigs map**

Replace the `onCycle` prop in the `faceConfigs.map` block (around line 413-421) with:

```tsx
onCycle={() => {
  // Always select the face
  setSelectedFace(config.face);
  // If active brush, also apply it
  if (activeBrush) {
    if (bayGroupIndices && bayGroupIndices.length > 1) {
      for (const bi of bayGroupIndices) setVoxelFace(containerId, bi, config.face, activeBrush);
    } else {
      setVoxelFace(containerId, voxelIndex, config.face, activeBrush);
    }
  }
}}
```

- [ ] **Step 3: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/VoxelPreview3D.tsx
git commit -m "feat: VoxelPreview3D face click sets selectedFace instead of cycling surface"
```

---

### Task 8: FinishesPanel Shell — VoxelPreview3D + Tabs + Active Tab

**Files:**
- Create: `src/components/ui/finishes/FinishesPanel.tsx`

- [ ] **Step 1: Create FinishesPanel.tsx**

Create `src/components/ui/finishes/FinishesPanel.tsx`:

```tsx
"use client";

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useSelectionTarget, type FaceKey } from '@/hooks/useSelectionTarget';
import VoxelPreview3D from '@/components/ui/VoxelPreview3D';
import FinishesTabBar, { faceToTab, type FinishTab } from './FinishesTabBar';
import FlooringTab from './FlooringTab';
import WallsTab from './WallsTab';
import CeilingTab from './CeilingTab';
import ElectricalTab from './ElectricalTab';

export default function FinishesPanel() {
  const target = useSelectionTarget();
  const selectedFace = useStore((s) => s.selectedFace) as FaceKey | null;

  const [activeTab, setActiveTab] = useState<FinishTab>('walls');

  // Auto-select tab when face changes
  useEffect(() => {
    const tab = faceToTab(selectedFace);
    if (tab) setActiveTab(tab);
  }, [selectedFace]);

  // Derive containerId, voxelIndex, indices from target
  let containerId = '';
  let voxelIndex = 0;
  let indices: number[] = [];
  let bayGroupIndices: number[] | undefined;

  if (target.type === 'face') {
    containerId = target.containerId;
    voxelIndex = target.index;
    indices = [voxelIndex];
  } else if (target.type === 'bay-face') {
    containerId = target.containerId;
    voxelIndex = target.indices[0];
    indices = target.indices;
    bayGroupIndices = target.indices;
  } else if (target.type === 'voxel') {
    containerId = target.containerId;
    voxelIndex = target.index;
    indices = [voxelIndex];
  } else if (target.type === 'bay') {
    containerId = target.containerId;
    voxelIndex = target.indices[0];
    indices = target.indices;
    bayGroupIndices = target.indices;
  }

  if (!containerId) return null;

  const hasFace = !!selectedFace;

  const tabProps = {
    containerId,
    voxelIndex,
    indices,
    face: selectedFace || ('n' as FaceKey), // fallback, tabs guard on hasFace
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* VoxelPreview3D — face selector */}
      <div style={{ padding: '8px 8px 0' }}>
        <VoxelPreview3D
          containerId={containerId}
          voxelIndex={voxelIndex}
          bayGroupIndices={bayGroupIndices}
        />
      </div>

      {/* Tab bar */}
      <FinishesTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        disabled={!hasFace}
      />

      {/* Tab content — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!hasFace ? (
          <div style={{ padding: '16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim, #64748b)' }}>
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
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/finishes/FinishesPanel.tsx
git commit -m "feat: add FinishesPanel shell with VoxelPreview3D + tab routing"
```

---

### Task 9: Sidebar Routing — Wire New FinishesPanel

**Files:**
- Modify: `src/components/ui/Sidebar.tsx:505-513`

- [ ] **Step 1: Update Sidebar imports**

In `src/components/ui/Sidebar.tsx`, replace:

```ts
import WallTypePicker from "@/components/ui/WallTypePicker";
import FinishesPanel from "@/components/ui/FinishesPanel";
```

with:

```ts
import FinishesPanel from "@/components/ui/finishes/FinishesPanel";
```

(Remove the WallTypePicker import — it's no longer used in Sidebar.)

- [ ] **Step 2: Update the routing conditional**

Replace the block at lines 505-513:

```tsx
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
```

with:

```tsx
{selectedObjectId ? (
  <SkinEditor />
) : (target.type === "voxel" || target.type === "bay" || target.type === "face" || target.type === "bay-face") ? (
  <FinishesPanel />
) : (
```

- [ ] **Step 3: Run type check and tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Sidebar.tsx
git commit -m "feat: merge Sidebar voxel/face routes into unified FinishesPanel"
```

---

### Task 10: Browser Verification + Final Tests

**Files:**
- Modify: `src/__tests__/finishes-panel.test.ts` (if needed)

- [ ] **Step 1: Run full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 type errors, all tests pass (existing + new)

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

- [ ] **Step 3: Browser verification checklist**

Verify each item in the browser:

1. Click a voxel body → VoxelPreview3D shows with all 6 faces, tab bar visible but grayed
2. Click a floor face in preview → Flooring tab auto-selects, texture swatches visible
3. Click a wall face in preview → Walls tab auto-selects, surface type picker visible
4. On wall with `Open` surface → only surface type picker shown, no empty panel
5. Change Open wall to Solid_Steel → finish options appear below picker
6. Click Ceiling tab → ceiling material + lighting sections visible
7. Click Electrical tab → electrical grid visible (or "available on walls" message for floor/ceiling)
8. Texture swatches show PBR crops for materials with textures (bamboo, concrete, steel)
9. Color picker appears on every tab
10. Tab switching works without changing the 3D highlight
11. Bay selection (Shift+click range) → finishes apply to all selected voxels

- [ ] **Step 4: Run /simplify**

Per CLAUDE.md rule 4: run `/simplify` after implementation, before final commit.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: finishes panel redesign — browser verified"
```

- [ ] **Step 6: Run acceptance gates**

Run: `npm run gates`
Expected: All gates pass, 0 FAIL
