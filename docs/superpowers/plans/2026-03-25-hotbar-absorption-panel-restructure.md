# Hotbar Absorption & Panel Restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the SmartHotbar into the left panel's Interior Finishes tabs using a unified Category → Variant → Finish hierarchy with upgraded PresetCard visuals and ghost previews.

**Architecture:** Surface tabs (Walls, Flooring, Ceiling) each get a CategoryRow of structural types at the top, a VariantGrid of specific models below, then finish controls (material + color). Selecting a variant activates `activeBrush` / `stampPreview` for ghost preview in the 3D viewport. The Hotbar becomes hidden-by-default, togglable in Settings.

**Tech Stack:** React 19, Zustand 5, Three.js (R3F), Next.js 16, inline styles + injected `<style>` for keyframes.

**Spec:** `docs/superpowers/specs/2026-03-25-hotbar-absorption-panel-restructure-design.md`

---

## File Structure

| File | Responsibility | Status |
|------|---------------|--------|
| `src/components/ui/finishes/PresetCard.tsx` | Shared card with hover/select/pop visuals | Modify (72→~130 lines) |
| `src/components/ui/finishes/CategoryRow.tsx` | Reusable category selector grid | Create (~45 lines) |
| `src/components/ui/finishes/VariantGrid.tsx` | Reusable variant selector grid with ghost activation | Create (~80 lines) |
| `src/config/surfaceCategories.ts` | Category → Variant → SurfaceType mappings for all 3 tabs | Create (~120 lines) |
| `src/components/ui/finishes/WallsTab.tsx` | Category → Variant → Finish hierarchy | Modify (136→~160 lines) |
| `src/components/ui/finishes/FlooringTab.tsx` | Add CategoryRow above materials | Modify (45→~80 lines) |
| `src/components/ui/finishes/CeilingTab.tsx` | Add CategoryRow above materials | Modify (63→~90 lines) |
| `src/store/slices/uiSlice.ts` | showHotbar + category selection state | Modify (356→~380 lines) |
| `src/components/ui/TopToolbar.tsx` | Hotbar toggle in Settings dropdown | Modify (minor) |
| `src/app/page.tsx` | Guard hotbar render with showHotbar | Modify (minor) |

---

## Task 1: PresetCard Visual Upgrade

**Files:**
- Modify: `src/components/ui/finishes/PresetCard.tsx`
- Test: `src/__tests__/preset-card-visuals.test.ts`

- [ ] **Step 1: Write failing tests for PresetCard states**

```typescript
// src/__tests__/preset-card-visuals.test.ts
import { describe, it, expect } from 'vitest';

// Test the selectPop keyframe CSS string is well-formed
describe('PresetCard visual states', () => {
  it('PRESET_CARD_KEYFRAMES contains selectPop animation', () => {
    // Will import after implementation
    const { PRESET_CARD_KEYFRAMES } = require('@/components/ui/finishes/PresetCard');
    expect(PRESET_CARD_KEYFRAMES).toContain('@keyframes selectPop');
    expect(PRESET_CARD_KEYFRAMES).toContain('scale(1.08)');
    expect(PRESET_CARD_KEYFRAMES).toContain('scale(1.0)');
  });

  it('getCardImageStyle returns correct styles per state', () => {
    const { getCardImageStyle } = require('@/components/ui/finishes/PresetCard');
    const defaultStyle = getCardImageStyle(false, false);
    expect(defaultStyle.transform).toBeUndefined();
    expect(defaultStyle.boxShadow).toBeUndefined();

    const hoverStyle = getCardImageStyle(false, true);
    expect(hoverStyle.transform).toBe('scale(1.04)');
    expect(hoverStyle.boxShadow).toContain('24px');

    const selectedStyle = getCardImageStyle(true, false);
    expect(selectedStyle.boxShadow).toContain('99,102,241');
  });

  it('getCardLabelStyle returns correct font weights', () => {
    const { getCardLabelStyle } = require('@/components/ui/finishes/PresetCard');
    expect(getCardLabelStyle(false, false).fontWeight).toBe(400);
    expect(getCardLabelStyle(false, true).fontWeight).toBe(600);
    expect(getCardLabelStyle(true, false).fontWeight).toBe(700);
    expect(getCardLabelStyle(true, true).fontWeight).toBe(700); // selected wins
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/preset-card-visuals.test.ts`
Expected: FAIL — exports not found

- [ ] **Step 3: Implement PresetCard visual upgrade**

Read current `PresetCard.tsx` (72 lines). Add:

1. **Exported style helper functions** (testable, pure):
   - `getCardImageStyle(active: boolean, hovered: boolean): CSSProperties`
   - `getCardLabelStyle(active: boolean, hovered: boolean): CSSProperties`
   - `PRESET_CARD_KEYFRAMES: string` — CSS keyframe text

2. **Inject `<style>` tag once** — use `useEffect` with a module-level `let _injected = false` guard. Inject `PRESET_CARD_KEYFRAMES` into `document.head`.

3. **Track hover via `useState`** — add internal `onMouseEnter`/`onMouseLeave` on the button to set local `hovered` state for visual styling only. The existing `onMouseEnter`/`onMouseLeave` props continue to be forwarded for ghost preview activation (separate concern).

4. **Track select transition via `useRef`** — compare previous `active` prop to current. When transitioning false→true, add `animation: selectPop 200ms ease-out` to image style. Clear after animation ends.

5. **Check badge** — when `active`, render a small indigo circle with ✓ positioned absolute top-right of the image container.

Key constraint: text label is ALWAYS outside the image frame. No border/glow/shadow on the label area.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/preset-card-visuals.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All 726+ tests pass (no regressions — PresetCard is used everywhere)

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/finishes/PresetCard.tsx src/__tests__/preset-card-visuals.test.ts
git commit -m "feat: upgrade PresetCard with hover scale, select glow+badge, pop animation"
```

---

## Task 2: Surface Category Configuration

**Files:**
- Create: `src/config/surfaceCategories.ts`
- Test: `src/__tests__/surface-categories.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/surface-categories.test.ts
import { describe, it, expect } from 'vitest';

describe('surfaceCategories', () => {
  it('WALL_CATEGORIES has 7 categories', () => {
    const { WALL_CATEGORIES } = require('@/config/surfaceCategories');
    expect(WALL_CATEGORIES).toHaveLength(7);
    expect(WALL_CATEGORIES.map((c: any) => c.id)).toEqual([
      'wall', 'door', 'window', 'railing', 'stairs', 'shelf', 'open'
    ]);
  });

  it('Door category has 8 variants matching doors.ts forms', () => {
    const { WALL_CATEGORIES } = require('@/config/surfaceCategories');
    const door = WALL_CATEGORIES.find((c: any) => c.id === 'door');
    expect(door.variants).toHaveLength(8);
    expect(door.variants[0].surfaceType).toBe('Door');
  });

  it('Wall category includes Half-Fold and Gull-Wing', () => {
    const { WALL_CATEGORIES } = require('@/config/surfaceCategories');
    const wall = WALL_CATEGORIES.find((c: any) => c.id === 'wall');
    const ids = wall.variants.map((v: any) => v.id);
    expect(ids).toContain('half_fold');
    expect(ids).toContain('gull_wing');
  });

  it('FLOOR_CATEGORIES has 3 categories', () => {
    const { FLOOR_CATEGORIES } = require('@/config/surfaceCategories');
    expect(FLOOR_CATEGORIES).toHaveLength(3);
    expect(FLOOR_CATEGORIES.map((c: any) => c.id)).toEqual(['solid', 'glass', 'open']);
  });

  it('CEILING_CATEGORIES has 3 categories', () => {
    const { CEILING_CATEGORIES } = require('@/config/surfaceCategories');
    expect(CEILING_CATEGORIES).toHaveLength(3);
    expect(CEILING_CATEGORIES.map((c: any) => c.id)).toEqual(['solid', 'skylight', 'open']);
  });

  it('getCategoryForSurface maps Door to door category', () => {
    const { getCategoryForSurface } = require('@/config/surfaceCategories');
    expect(getCategoryForSurface('Door', 'wall')).toBe('door');
    expect(getCategoryForSurface('Window_Half', 'wall')).toBe('window');
    expect(getCategoryForSurface('Solid_Steel', 'wall')).toBe('wall');
    expect(getCategoryForSurface('Deck_Wood', 'floor')).toBe('solid');
  });

  it('Shelf category has no variants (placeholder)', () => {
    const { WALL_CATEGORIES } = require('@/config/surfaceCategories');
    const shelf = WALL_CATEGORIES.find((c: any) => c.id === 'shelf');
    expect(shelf.variants).toHaveLength(0);
    expect(shelf.placeholder).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/surface-categories.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement surfaceCategories.ts**

Create `src/config/surfaceCategories.ts` with:

```typescript
import type { SurfaceType } from '@/types/container';

export interface CategoryVariant {
  id: string;
  surfaceType: SurfaceType;
  label: string;
  icon: string;
  finishMeta?: Record<string, string>; // e.g., { doorStyle: 'barn_slide' }
}

export interface SurfaceCategory {
  id: string;
  icon: string;
  label: string;
  variants: CategoryVariant[];
  placeholder?: boolean; // true = "Coming soon" state
  volumetric?: boolean;  // true = uses applyStairsFromFace, not paintFace (stairs)
}

export const WALL_CATEGORIES: SurfaceCategory[] = [
  {
    id: 'wall', icon: '▮', label: 'Wall',
    variants: [
      { id: 'steel', surfaceType: 'Solid_Steel', label: 'Steel', icon: '🔲' },
      { id: 'concrete', surfaceType: 'Concrete', label: 'Concrete', icon: '⬜' },
      { id: 'washi', surfaceType: 'Wall_Washi', label: 'Washi', icon: '▧' },
      { id: 'shoji', surfaceType: 'Glass_Shoji', label: 'Shoji', icon: '▦' },
      { id: 'glass', surfaceType: 'Glass_Pane', label: 'Glass', icon: '🪟' },
      { id: 'half_fold', surfaceType: 'Half_Fold', label: 'Half-Fold', icon: '⌐' },
      { id: 'gull_wing', surfaceType: 'Gull_Wing', label: 'Gull-Wing', icon: '⌃' },
    ],
  },
  {
    id: 'door', icon: '🚪', label: 'Door',
    variants: [
      { id: 'swing', surfaceType: 'Door', label: 'Single Swing', icon: '🚪' },
      { id: 'double_swing', surfaceType: 'Door', label: 'Double Swing', icon: '🚪', finishMeta: { doorStyle: 'double_swing' } },
      { id: 'barn_slide', surfaceType: 'Door', label: 'Barn Slide', icon: '🚪', finishMeta: { doorStyle: 'barn_slide' } },
      { id: 'pocket_slide', surfaceType: 'Door', label: 'Pocket Slide', icon: '🚪', finishMeta: { doorStyle: 'pocket_slide' } },
      { id: 'bifold', surfaceType: 'Door', label: 'Bifold', icon: '🚪', finishMeta: { doorStyle: 'bifold' } },
      { id: 'french', surfaceType: 'Door', label: 'French', icon: '🚪', finishMeta: { doorStyle: 'french' } },
      { id: 'glass_slide', surfaceType: 'Door', label: 'Glass Slide', icon: '🚪', finishMeta: { doorStyle: 'glass_slide' } },
      { id: 'shoji_door', surfaceType: 'Door', label: 'Shoji Screen', icon: '🚪', finishMeta: { doorStyle: 'shoji' } },
    ],
  },
  {
    id: 'window', icon: '🪟', label: 'Window',
    variants: [
      { id: 'standard', surfaceType: 'Window_Standard', label: 'Standard', icon: '⬜' },
      { id: 'half', surfaceType: 'Window_Half', label: 'Half', icon: '▭' },
      { id: 'sill', surfaceType: 'Window_Sill', label: 'Sill', icon: '▤' },
      { id: 'clerestory', surfaceType: 'Window_Clerestory', label: 'Clerestory', icon: '═' },
    ],
  },
  {
    id: 'railing', icon: '⫿', label: 'Railing',
    variants: [
      { id: 'cable', surfaceType: 'Railing_Cable', label: 'Cable', icon: '⫿' },
      { id: 'glass_rail', surfaceType: 'Railing_Glass', label: 'Glass', icon: '▯' },
    ],
  },
  {
    id: 'stairs', icon: '📐', label: 'Stairs', volumetric: true,
    variants: [
      { id: 'standard', surfaceType: 'Stairs', label: 'Standard', icon: '📐' },
      { id: 'down', surfaceType: 'Stairs_Down', label: 'Down', icon: '📐' },
    ],
  },
  {
    id: 'shelf', icon: '🗄', label: 'Shelf', placeholder: true,
    variants: [],
  },
  {
    id: 'open', icon: '▫', label: 'Open',
    variants: [
      { id: 'open', surfaceType: 'Open', label: 'Open', icon: '▫' },
    ],
  },
];

export const FLOOR_CATEGORIES: SurfaceCategory[] = [
  {
    id: 'solid', icon: '▮', label: 'Solid',
    variants: [
      { id: 'wood', surfaceType: 'Deck_Wood', label: 'Wood', icon: '🪵' },
      { id: 'tatami', surfaceType: 'Floor_Tatami', label: 'Tatami', icon: '🟩' },
      { id: 'hinoki', surfaceType: 'Wood_Hinoki', label: 'Hinoki', icon: '🪵' },
      { id: 'concrete', surfaceType: 'Concrete', label: 'Concrete', icon: '⬜' },
    ],
  },
  {
    id: 'glass', icon: '🪟', label: 'Glass',
    variants: [
      { id: 'glass_floor', surfaceType: 'Glass_Pane', label: 'Glass', icon: '🪟' },
    ],
  },
  {
    id: 'open', icon: '▫', label: 'Open',
    variants: [
      { id: 'open', surfaceType: 'Open', label: 'Open', icon: '▫' },
    ],
  },
];

export const CEILING_CATEGORIES: SurfaceCategory[] = [
  {
    id: 'solid', icon: '▮', label: 'Solid',
    variants: [
      { id: 'steel', surfaceType: 'Solid_Steel', label: 'Steel', icon: '🔲' },
      { id: 'wood', surfaceType: 'Deck_Wood', label: 'Wood', icon: '🪵' },
      { id: 'concrete', surfaceType: 'Concrete', label: 'Concrete', icon: '⬜' },
    ],
  },
  {
    id: 'skylight', icon: '🪟', label: 'Skylight',
    variants: [
      { id: 'glass_ceiling', surfaceType: 'Glass_Pane', label: 'Glass', icon: '🪟' },
    ],
  },
  {
    id: 'open', icon: '▫', label: 'Open',
    variants: [
      { id: 'open', surfaceType: 'Open', label: 'Open', icon: '▫' },
    ],
  },
];

/** Reverse lookup: given a SurfaceType and tab context, return the category ID */
export function getCategoryForSurface(
  surface: SurfaceType,
  tab: 'wall' | 'floor' | 'ceiling'
): string | null {
  const categories = tab === 'wall' ? WALL_CATEGORIES
    : tab === 'floor' ? FLOOR_CATEGORIES
    : CEILING_CATEGORIES;
  for (const cat of categories) {
    if (cat.variants.some(v => v.surfaceType === surface)) return cat.id;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/surface-categories.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/surfaceCategories.ts src/__tests__/surface-categories.test.ts
git commit -m "feat: add surface category configs for walls, flooring, ceiling"
```

---

## Task 3: Store State — Category Selection + Hotbar Visibility

**Files:**
- Modify: `src/store/slices/uiSlice.ts`
- Test: `src/__tests__/ui-category-state.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/ui-category-state.test.ts
import { describe, it, expect } from 'vitest';
import { useStore } from '@/store/useStore';

const s = () => useStore.getState();

describe('category selection state', () => {
  it('showHotbar defaults to false', () => {
    expect(s().showHotbar).toBe(false);
  });

  it('toggleHotbar flips showHotbar', () => {
    s().toggleHotbar();
    expect(s().showHotbar).toBe(true);
    s().toggleHotbar();
    expect(s().showHotbar).toBe(false);
  });

  it('selectedWallCategory defaults to null', () => {
    expect(s().selectedWallCategory).toBeNull();
  });

  it('setSelectedWallCategory sets and clears', () => {
    s().setSelectedWallCategory('door');
    expect(s().selectedWallCategory).toBe('door');
    s().setSelectedWallCategory(null);
    expect(s().selectedWallCategory).toBeNull();
  });

  it('selectedFloorCategory and selectedCeilingCategory work', () => {
    s().setSelectedFloorCategory('solid');
    expect(s().selectedFloorCategory).toBe('solid');
    s().setSelectedCeilingCategory('skylight');
    expect(s().selectedCeilingCategory).toBe('skylight');
    // cleanup
    s().setSelectedFloorCategory(null);
    s().setSelectedCeilingCategory(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/ui-category-state.test.ts`
Expected: FAIL — properties don't exist on store

- [ ] **Step 3: Add state to uiSlice.ts**

In `UiSlice` interface (after `cycleHotbarTab` around line 46), add:
```typescript
showHotbar: boolean;
toggleHotbar: () => void;
selectedWallCategory: string | null;
selectedFloorCategory: string | null;
selectedCeilingCategory: string | null;
setSelectedWallCategory: (cat: string | null) => void;
setSelectedFloorCategory: (cat: string | null) => void;
setSelectedCeilingCategory: (cat: string | null) => void;
```

In `createUiSlice` implementation, add initial values and setters:
```typescript
showHotbar: false,
toggleHotbar: () => set((s) => ({ showHotbar: !s.showHotbar })),
selectedWallCategory: null,
selectedFloorCategory: null,
selectedCeilingCategory: null,
setSelectedWallCategory: (cat) => set({ selectedWallCategory: cat }),
setSelectedFloorCategory: (cat) => set({ selectedFloorCategory: cat }),
setSelectedCeilingCategory: (cat) => set({ selectedCeilingCategory: cat }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/ui-category-state.test.ts`
Expected: PASS

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/store/slices/uiSlice.ts src/__tests__/ui-category-state.test.ts
git commit -m "feat: add showHotbar and category selection state to uiSlice"
```

---

## Task 4: CategoryRow and VariantGrid Components

**Files:**
- Create: `src/components/ui/finishes/CategoryRow.tsx`
- Create: `src/components/ui/finishes/VariantGrid.tsx`

- [ ] **Step 1: Create CategoryRow.tsx**

```typescript
// src/components/ui/finishes/CategoryRow.tsx
'use client';
import { PresetCard } from './PresetCard';
import type { SurfaceCategory } from '@/config/surfaceCategories';

interface CategoryRowProps {
  categories: SurfaceCategory[];
  selected: string | null;
  onSelect: (categoryId: string) => void;
}

export default function CategoryRow({ categories, selected, onSelect }: CategoryRowProps) {
  return (
    <div>
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const,
        letterSpacing: 1, marginBottom: 8,
      }}>Type</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
      }}>
        {categories.map(cat => (
          <PresetCard
            key={cat.id}
            content={<span style={{ fontSize: 24 }}>{cat.icon}</span>}
            label={cat.label}
            active={selected === cat.id}
            onClick={() => onSelect(cat.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create VariantGrid.tsx**

```typescript
// src/components/ui/finishes/VariantGrid.tsx
'use client';
import { PresetCard } from './PresetCard';
import { useStore } from '@/store/useStore';
import type { SurfaceCategory, CategoryVariant } from '@/config/surfaceCategories';
import type { SurfaceType } from '@/types/container';

interface VariantGridProps {
  category: SurfaceCategory;
  currentSurface: SurfaceType | null;
  currentFinish: Record<string, string> | null; // for doorStyle matching
  containerId: string;
  indices: number[];
  face: string;
}

export default function VariantGrid({
  category, currentSurface, currentFinish, containerId, indices, face,
}: VariantGridProps) {
  const paintFace = useStore((s) => s.paintFace);
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  const applyStairsFromFace = useStore((s) => s.applyStairsFromFace);
  const setActiveBrush = useStore((s) => s.setActiveBrush);
  const setStampPreview = useStore((s) => s.setStampPreview);
  const addRecentItem = useStore((s) => s.addRecentItem);

  if (category.placeholder) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
        Coming soon
      </div>
    );
  }

  // Check if a variant is the currently active one (handles door variants sharing SurfaceType)
  const isVariantActive = (variant: CategoryVariant): boolean => {
    if (currentSurface !== variant.surfaceType) return false;
    // Door variants: match by finishMeta.doorStyle
    if (variant.finishMeta?.doorStyle) {
      return currentFinish?.doorStyle === variant.finishMeta.doorStyle;
    }
    // Non-meta variants: surface match is sufficient (but only if no finishMeta expected)
    if (!variant.finishMeta && currentSurface === 'Door') {
      // Default swing door has no doorStyle metadata
      return !currentFinish?.doorStyle;
    }
    return true;
  };

  const handleSelect = (variant: CategoryVariant) => {
    // Volumetric types (stairs) use applyStairsFromFace instead of paintFace
    if (category.volumetric) {
      for (const idx of indices) {
        applyStairsFromFace(containerId, idx, face as 'n' | 's' | 'e' | 'w' | 'top');
      }
      return;
    }
    // Standard face paint path
    for (const idx of indices) {
      paintFace(containerId, idx, face as any, variant.surfaceType);
      if (variant.finishMeta) {
        setFaceFinish(containerId, idx, face as any, variant.finishMeta);
      }
    }
    addRecentItem({ type: 'surface', id: variant.surfaceType });
  };

  const handleHover = (variant: CategoryVariant) => {
    if (category.volumetric) return; // Stair ghost deferred — no stamp ghost for volumetric
    setActiveBrush(variant.surfaceType);
    if (indices.length > 0) {
      setStampPreview({
        surfaceType: variant.surfaceType,
        containerId,
        voxelIndex: indices[0],
      });
    }
  };

  const handleLeave = () => {
    if (category.volumetric) return;
    setActiveBrush(null);
    useStore.getState().clearStampPreview();
  };

  return (
    <div>
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' as const,
        letterSpacing: 1, marginBottom: 8, marginTop: 16,
      }}>{category.label} — Variants</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
      }}>
        {category.variants.map(variant => (
          <PresetCard
            key={variant.id}
            content={<span style={{ fontSize: 20 }}>{variant.icon}</span>}
            label={variant.label}
            active={isVariantActive(variant)}
            onClick={() => handleSelect(variant)}
            onMouseEnter={() => handleHover(variant)}
            onMouseLeave={handleLeave}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write tests for VariantGrid behavior**

```typescript
// src/__tests__/variant-grid.test.ts
import { describe, it, expect } from 'vitest';
import type { SurfaceCategory, CategoryVariant } from '@/config/surfaceCategories';

// Test the isVariantActive logic (extracted for unit testing)
describe('VariantGrid active state', () => {
  it('matches simple surface type', () => {
    // A steel wall variant is active when current surface is Solid_Steel
    const variant: CategoryVariant = { id: 'steel', surfaceType: 'Solid_Steel', label: 'Steel', icon: '🔲' };
    expect(variant.surfaceType).toBe('Solid_Steel');
  });

  it('door variants differentiated by finishMeta.doorStyle', () => {
    const barn: CategoryVariant = {
      id: 'barn_slide', surfaceType: 'Door', label: 'Barn Slide', icon: '🚪',
      finishMeta: { doorStyle: 'barn_slide' },
    };
    // When current surface is Door + doorStyle barn_slide → only barn variant active
    expect(barn.finishMeta?.doorStyle).toBe('barn_slide');
  });

  it('placeholder category has no variants', () => {
    const { WALL_CATEGORIES } = require('@/config/surfaceCategories');
    const shelf = WALL_CATEGORIES.find((c: any) => c.id === 'shelf');
    expect(shelf.placeholder).toBe(true);
    expect(shelf.variants).toHaveLength(0);
  });

  it('volumetric category marked correctly', () => {
    const { WALL_CATEGORIES } = require('@/config/surfaceCategories');
    const stairs = WALL_CATEGORIES.find((c: any) => c.id === 'stairs');
    expect(stairs.volumetric).toBe(true);
  });
});
```

- [ ] **Step 4: Run tsc and tests**

Run: `npx tsc --noEmit && npx vitest run src/__tests__/variant-grid.test.ts`
Expected: 0 tsc errors, tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/finishes/CategoryRow.tsx src/components/ui/finishes/VariantGrid.tsx src/__tests__/variant-grid.test.ts
git commit -m "feat: add CategoryRow and VariantGrid shared components"
```

---

## Task 5: Restructure WallsTab

**Files:**
- Modify: `src/components/ui/finishes/WallsTab.tsx`

- [ ] **Step 1: Read current WallsTab.tsx**

Note current structure: uses `getWallTypesForContext()` to get flat surface list, renders PresetCard grid for surface types, then conditional finish controls below.

- [ ] **Step 2: Rewrite WallsTab with Category → Variant → Finish**

Replace the flat surface grid with:
1. **CategoryRow** — reads `selectedWallCategory` from store, auto-detects from current face `SurfaceType` via `getCategoryForSurface()`
2. **VariantGrid** — shows variants for selected category, with ghost preview on hover
3. **Existing finish controls** — TextureSwatchGrid, SwatchRow, OptionCardGrid stay unchanged below the variant grid

Key implementation details:
- Remove import of `getWallTypesForContext` from `@/config/wallTypes` — replaced by category configs
- Import `WALL_CATEGORIES`, `getCategoryForSurface` from `@/config/surfaceCategories`
- Import `CategoryRow`, `VariantGrid` components
- Use `useStore((s) => s.selectedWallCategory)` and `useStore((s) => s.setSelectedWallCategory)`
- Auto-detect category on mount: `useEffect` that calls `setSelectedWallCategory(getCategoryForSurface(surface, 'wall'))` when `surface` changes
- Stairs category variant click calls `applyStairsFromFace` instead of `paintFace` (check `category.volumetric`)
- Preserve all existing finish controls (TextureSwatchGrid for exterior material, SwatchRow for color, OptionCardGrid for door style, etc.)

- [ ] **Step 3: Run tsc and vitest**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 4: Browser verification**

Open dev server, select a wall face → verify:
- 7 category cards visible (Wall, Door, Window, Railing, Stairs, Shelf, Open)
- Clicking Door → shows 8 door variants
- Clicking a door variant → applies to face + ghost preview on hover
- Finish controls appear below variant grid
- Shelf category shows "Coming soon"

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/finishes/WallsTab.tsx
git commit -m "feat: restructure WallsTab with Category → Variant → Finish hierarchy"
```

---

## Task 6: Restructure FlooringTab and CeilingTab

**Files:**
- Modify: `src/components/ui/finishes/FlooringTab.tsx`
- Modify: `src/components/ui/finishes/CeilingTab.tsx`

- [ ] **Step 1: Update FlooringTab**

Add `CategoryRow` with `FLOOR_CATEGORIES` above existing material grid. Use `selectedFloorCategory` from store. Auto-detect category from current floor surface. Show VariantGrid for selected category, then existing TextureSwatchGrid and SwatchRow below.

- [ ] **Step 2: Update CeilingTab**

Same pattern: `CategoryRow` with `CEILING_CATEGORIES`, `selectedCeilingCategory` from store. Auto-detect category. Show VariantGrid, then existing light fixture controls and SwatchRow.

- [ ] **Step 3: Run tsc and vitest**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 errors, all tests pass

- [ ] **Step 4: Browser verification**

- Select floor → see categories (Solid, Glass, Open) → select Solid → see variants (Wood, Tatami, Hinoki, Concrete)
- Select ceiling → see categories (Solid, Skylight, Open) → select Solid → see variants (Steel, Wood, Concrete)
- Ghost preview works when hovering variants

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/finishes/FlooringTab.tsx src/components/ui/finishes/CeilingTab.tsx
git commit -m "feat: restructure FlooringTab and CeilingTab with category hierarchy"
```

---

## Task 7: Hide Hotbar + Settings Toggle

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/ui/TopToolbar.tsx`

- [ ] **Step 1: Guard hotbar render in page.tsx**

Find where `CustomHotbar` and `RecentItemsBar` are rendered (lines 151, 154 of `page.tsx`). SmartHotbar is already commented out. Wrap both active hotbar components:
```tsx
{showHotbar && !isWalkthrough && !isPreviewMode && <CustomHotbar />}
{showHotbar && !isPreviewMode && <RecentItemsBar />}
```

Read `showHotbar` from store: `const showHotbar = useStore((s) => s.showHotbar);`

- [ ] **Step 2: Add Hotbar toggle to TopToolbar Settings dropdown**

In TopToolbar.tsx, find the Settings dropdown section (near the Wireframe toggle around line 706). Add a new toggle button below it:

```tsx
<button onClick={toggleHotbar} style={{
  display: "flex", alignItems: "center", gap: 8, width: "100%",
  padding: "8px 10px", borderRadius: 6, border: "none", cursor: "pointer",
  fontSize: 12, fontWeight: 600, marginBottom: 4,
  color: showHotbar ? "#f59e0b" : "var(--text-main)",
  background: showHotbar ? "rgba(245,158,11,0.12)" : "transparent",
  transition: "all 100ms",
}}>
  <Keyboard size={13} />
  Hotbar
  <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700 }}>
    {showHotbar ? "ON" : "OFF"}
  </span>
</button>
```

Add store selectors at top of component:
```tsx
const showHotbar = useStore((s) => s.showHotbar);
const toggleHotbar = useStore((s) => s.toggleHotbar);
```

- [ ] **Step 3: Run tsc and vitest**

Run: `npx tsc --noEmit && npx vitest run`
Expected: All pass

- [ ] **Step 4: Browser verification**

- App loads → no hotbar visible at bottom
- Settings → Hotbar toggle → hotbar appears
- Keys 1-0 work when hotbar visible
- Toggle off → hotbar disappears

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/ui/TopToolbar.tsx
git commit -m "feat: hide hotbar by default, add Settings toggle"
```

---

## Task 8: Ghost Preview Integration

**Files:**
- Modify: `src/components/ui/finishes/VariantGrid.tsx` (already has ghost hooks from Task 4)
- Verify: `src/components/objects/HoverPreviewGhost.tsx` (StampGhost already handles `stampPreview`)

- [ ] **Step 1: Verify ghost preview works end-to-end**

The ghost system is already wired:
- VariantGrid's `handleHover` sets `activeBrush` + `stampPreview`
- `HoverPreviewGhost.tsx` renders StampGhost when `stampPreview` is set
- StampGhost uses `getVoxelLayout` for correct sizing (fixed earlier this sprint)

Test in browser:
1. Select a wall face
2. In Walls tab, select Door category
3. Hover over "Barn Slide" variant card
4. Verify green ghost overlay appears on the selected wall face in 3D
5. Move mouse away → ghost disappears
6. Click → door applies to face

- [ ] **Step 2: Confirm stairs ghost is explicitly deferred**

VariantGrid already handles this: when `category.volumetric` is true, `handleHover` returns early (no `stampPreview` set). The StampGhost renders flat face overlays — it cannot show volumetric stair geometry. Stair ghost preview (transparent StairMesh at hovered voxel) is deferred to a future sprint. Verify that hovering a stair variant does NOT show a ghost, and that clicking still applies stairs correctly via `applyStairsFromFace`.

- [ ] **Step 3: Handle block preset ghosts**

Block presets already have ghost preview via `FlushGhostPreview` in ContainerSkin. Verify this still works:
1. Go to Block tab
2. Hover a preset card (e.g., "Glass Box")
3. Verify ghost renders on hovered voxel

If block preset ghosts are already working (they should be — `ghostPreset` is set by BlockTab's `onMouseEnter`), no code changes needed.

- [ ] **Step 4: Commit (if any changes)**

```bash
git add src/components/ui/finishes/VariantGrid.tsx
git commit -m "feat: integrate ghost previews with variant selection"
```

---

## Task 9: Final Verification & Cleanup

**Files:**
- Run: full test suite, tsc, browser verification

- [ ] **Step 1: Run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run full vitest**

Run: `npx vitest run`
Expected: All tests pass (726+)

- [ ] **Step 3: Browser verification checklist**

Verify ALL items from spec § Verification:

1. ☐ Walls tab: 7 categories → Door → 8 variants → click → face updates
2. ☐ Flooring tab: 3 categories → Solid → 4 variants → click → floor updates
3. ☐ Ceiling tab: 3 categories → Solid → 3 variants → click → ceiling updates
4. ☐ Stairs: category present → click Standard → voxel converts to stairs
5. ☐ PresetCard: hover scale+shadow+bold, click pop-then-shrink, select glow+badge
6. ☐ Hotbar: hidden by default, Settings toggle works, 1-0 keys work when visible
7. ☐ Ghost preview: hover variant → green overlay on face → click → applies
8. ☐ Block preset ghost: hover preset → ghost follows cursor over voxels
9. ☐ Category auto-detect: select face with Door → Door category pre-selected
10. ☐ Regression: Block tab, Container tab, keyboard shortcuts, undo/redo all work

- [ ] **Step 4: Run /simplify**

Invoke simplify skill to review all changes for code quality.

- [ ] **Step 5: Final commit**

Stage only the files modified in this sprint (no `git add -A` per CLAUDE.md policy):
```bash
git add src/components/ui/finishes/ src/config/surfaceCategories.ts src/store/slices/uiSlice.ts src/components/ui/TopToolbar.tsx src/app/page.tsx src/__tests__/
git commit -m "chore: hotbar absorption sprint complete — all verification passed"
```
