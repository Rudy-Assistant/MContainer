# Phase 2 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining Phase 2 Smart Architecture work — Frame Mode (view toggle, 3D/2D interaction, Inspector), view isolation rendering, 2D bay mode, and railing merge verification.

**Architecture:** Three independent systems wired through `uiSlice` state (`frameMode`, `inspectorView`). Frame data model lives on `ContainerState` (persisted). View isolation is a pure function mapping toggle states to opacity values. Bay mode switches `MatrixEditor` rendering based on `designComplexity`.

**Tech Stack:** React 19, TypeScript, Zustand 5 (immer + temporal + persist), Three.js via @react-three/fiber, SVG for 2D grid, Vitest for testing.

**Spec:** `docs/superpowers/specs/2026-03-20-phase2-completion-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/config/frameMaterials.ts` | Material/shape registries for poles and rails |
| `src/utils/viewIsolation.ts` | Pure function: toggle state → opacity values |
| `src/components/ui/FrameInspector.tsx` | Inspector panel for frame element config |
| `src/__tests__/frame-data-model.test.ts` | Store actions, override resolution |
| `src/__tests__/view-isolation.test.ts` | Opacity calculation for all toggle combos |
| `src/__tests__/railing-merge.test.ts` | Adjacent railing autotiling verification |
| `src/__tests__/bay-mode.test.ts` | Bay cell rendering, selection, painting |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/container.ts` | Add `ElementConfig`, `frameDefaults`, `railOverrides`; remove `poleDefaults` |
| `src/store/slices/uiSlice.ts` | Add `frameMode`, `selectedFrameElement`, toggles |
| `src/store/slices/containerSlice.ts` | Add `setFrameDefaults`, `setFrameElementOverride`, `clearFrameElementOverride`, `batchSetFrameOverrides` |
| `src/store/useStore.ts` | Persist new fields, invalidate on frameMode changes |
| `src/components/ui/TopToolbar.tsx` | Add Frame toggle button |
| `src/components/ui/Sidebar.tsx` | Route to FrameInspector in frame mode |
| `src/components/ui/MatrixEditor.tsx` | Frame Mode SVG overlay (edges + intersections) |
| `src/components/three/ContainerMesh.tsx` | Frame element hover/select handlers, raycast toggle |
| `src/components/objects/ContainerSkin.tsx` | Pole override lookup, view isolation opacity |

---

## Task 1: Frame Material Registries

**Files:**
- Create: `src/config/frameMaterials.ts`

- [ ] **Step 1: Create the registries file**

```typescript
// src/config/frameMaterials.ts
export const POLE_MATERIALS = ['Steel', 'Wood', 'Concrete', 'Aluminum'] as const;
export type PoleMaterial = (typeof POLE_MATERIALS)[number];

export const POLE_SHAPES = ['Round', 'Square', 'I-Beam', 'H-Beam'] as const;
export type PoleShape = (typeof POLE_SHAPES)[number];

export const RAIL_MATERIALS = ['Steel', 'Wood', 'Aluminum'] as const;
export type RailMaterial = (typeof RAIL_MATERIALS)[number];

export const RAIL_SHAPES = ['Round', 'Square', 'Channel'] as const;
export type RailShape = (typeof RAIL_SHAPES)[number];

/** Default frame config used when container has no frameDefaults and no theme override */
export const DEFAULT_FRAME_CONFIG = {
  poleMaterial: 'Steel' as PoleMaterial,
  poleShape: 'Round' as PoleShape,
  railMaterial: 'Steel' as RailMaterial,
  railShape: 'Round' as RailShape,
} as const;

/** Resolve a frame property through the override cascade: element > frameDefaults > theme */
export function resolveFrameProperty(
  override: { material?: string; shape?: string } | undefined,
  defaults: { poleMaterial?: string; poleShape?: string; railMaterial?: string; railShape?: string } | undefined,
  elementType: 'pole' | 'rail',
  prop: 'material' | 'shape',
): string {
  // 1. Element override
  if (override?.[prop]) return override[prop]!;
  // 2. Container frameDefaults
  const defaultKey = `${elementType}${prop.charAt(0).toUpperCase() + prop.slice(1)}` as keyof typeof DEFAULT_FRAME_CONFIG;
  if (defaults?.[defaultKey]) return defaults[defaultKey]!;
  // 3. Theme default
  return DEFAULT_FRAME_CONFIG[defaultKey];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/config/frameMaterials.ts
git commit -m "feat: add frame material/shape registries"
```

---

## Task 2: Frame Data Model Types

**Files:**
- Modify: `src/types/container.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/frame-data-model.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve(); }),
    del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  };
});

import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import type { ElementConfig } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

function addContainer(): string {
  return useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
}

describe('Frame Data Model', () => {
  beforeEach(() => resetStore());

  it('FDM-1: ElementConfig type exists and is importable', () => {
    const config: ElementConfig = { visible: true, material: 'Steel', shape: 'Round' };
    expect(config.visible).toBe(true);
    expect(config.material).toBe('Steel');
    expect(config.shape).toBe('Round');
  });

  it('FDM-2: Container has frameDefaults field (replaces poleDefaults)', () => {
    const id = addContainer();
    const c = useStore.getState().containers[id];
    // frameDefaults should be undefined by default (falls back to theme)
    expect(c.frameDefaults).toBeUndefined();
    // poleDefaults should NOT exist (migrated to frameDefaults)
    expect((c as any).poleDefaults).toBeUndefined();
  });

  it('FDM-3: Container has railOverrides field', () => {
    const id = addContainer();
    const c = useStore.getState().containers[id];
    expect(c.railOverrides).toBeUndefined();
  });

  it('FDM-4: Container keeps poleOverrides field', () => {
    const id = addContainer();
    const c = useStore.getState().containers[id];
    expect(c.poleOverrides).toBeUndefined(); // undefined by default, but field exists on type
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/frame-data-model.test.ts`
Expected: FAIL — `ElementConfig` is not exported from `@/types/container`

- [ ] **Step 3: Add ElementConfig and update Container interface**

In `src/types/container.ts`, add the `ElementConfig` interface near `PoleConfig` (around line 324):

```typescript
/** Configuration for a rail element (visibility, material, shape) */
export interface ElementConfig {
  /** Whether this rail is visible (default: true, inherits from container) */
  visible?: boolean;
  /** Material override (default: inherit from frameDefaults) */
  material?: string;
  /** Shape/model override (default: inherit from frameDefaults) */
  shape?: string;
}
```

In the `Container` interface, replace `poleDefaults` with `frameDefaults` and add `railOverrides` (around lines 188-192):

```typescript
  // ── Smart Frame Configuration ────────────────────────────
  /** Container-level default style for all frame elements (poles + rails) */
  frameDefaults?: {
    poleMaterial?: string;
    poleShape?: string;
    railMaterial?: string;
    railShape?: string;
  };
  /** Per-pole overrides keyed by "l{level}r{row}c{col}_{corner}" */
  poleOverrides?: Record<string, PoleConfig>;
  /** Per-rail overrides keyed by "r{row}c{col}_{h|v}" */
  railOverrides?: Record<string, ElementConfig>;
```

Remove the old `poleDefaults` line.

- [ ] **Step 4: Fix any references to poleDefaults in the codebase**

Search for `poleDefaults` in all `.ts`/`.tsx` files. Update any references to use `frameDefaults.poleMaterial` / `frameDefaults.poleShape` instead.

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/frame-data-model.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/types/container.ts src/__tests__/frame-data-model.test.ts
git commit -m "feat: add ElementConfig, frameDefaults, railOverrides to Container type"
```

---

## Task 3: Frame Store Actions

**Files:**
- Modify: `src/store/slices/containerSlice.ts`
- Modify: `src/store/useStore.ts`
- Test: `src/__tests__/frame-data-model.test.ts`

- [ ] **Step 1: Add failing tests for store actions**

Append to `src/__tests__/frame-data-model.test.ts`:

```typescript
describe('Frame Store Actions', () => {
  beforeEach(() => resetStore());

  it('FSA-1: setFrameDefaults sets container-level defaults', () => {
    const id = addContainer();
    useStore.getState().setFrameDefaults(id, { poleMaterial: 'Wood', railShape: 'Channel' });
    const c = useStore.getState().containers[id];
    expect(c.frameDefaults?.poleMaterial).toBe('Wood');
    expect(c.frameDefaults?.railShape).toBe('Channel');
    expect(c.frameDefaults?.poleShape).toBeUndefined(); // only set what was passed
  });

  it('FSA-2: setFrameElementOverride sets a pole override (key starts with l)', () => {
    const id = addContainer();
    useStore.getState().setFrameElementOverride(id, 'l0r1c2_ne', { visible: false, material: 'Concrete' });
    const c = useStore.getState().containers[id];
    expect(c.poleOverrides?.['l0r1c2_ne']).toEqual({ visible: false, material: 'Concrete' });
  });

  it('FSA-3: setFrameElementOverride sets a rail override (key starts with r)', () => {
    const id = addContainer();
    useStore.getState().setFrameElementOverride(id, 'r1c2_h', { material: 'Wood' });
    const c = useStore.getState().containers[id];
    expect(c.railOverrides?.['r1c2_h']).toEqual({ material: 'Wood' });
  });

  it('FSA-4: clearFrameElementOverride removes a pole override', () => {
    const id = addContainer();
    useStore.getState().setFrameElementOverride(id, 'l0r1c2_ne', { visible: false });
    useStore.getState().clearFrameElementOverride(id, 'l0r1c2_ne');
    const c = useStore.getState().containers[id];
    expect(c.poleOverrides?.['l0r1c2_ne']).toBeUndefined();
  });

  it('FSA-5: clearFrameElementOverride removes a rail override', () => {
    const id = addContainer();
    useStore.getState().setFrameElementOverride(id, 'r1c2_h', { material: 'Wood' });
    useStore.getState().clearFrameElementOverride(id, 'r1c2_h');
    const c = useStore.getState().containers[id];
    expect(c.railOverrides?.['r1c2_h']).toBeUndefined();
  });

  it('FSA-6: batchSetFrameOverrides applies config to multiple elements', () => {
    const id = addContainer();
    useStore.getState().batchSetFrameOverrides(id, ['r0c0_h', 'r0c1_h', 'r0c2_h'], { material: 'Aluminum' });
    const c = useStore.getState().containers[id];
    expect(c.railOverrides?.['r0c0_h']?.material).toBe('Aluminum');
    expect(c.railOverrides?.['r0c1_h']?.material).toBe('Aluminum');
    expect(c.railOverrides?.['r0c2_h']?.material).toBe('Aluminum');
  });

  it('FSA-7: Override resolution: element override > frameDefaults > theme', () => {
    const id = addContainer();
    useStore.getState().setFrameDefaults(id, { poleMaterial: 'Wood' });
    useStore.getState().setFrameElementOverride(id, 'l0r1c2_ne', { material: 'Concrete' });
    const c = useStore.getState().containers[id];
    // Element-level override wins
    expect(c.poleOverrides?.['l0r1c2_ne']?.material).toBe('Concrete');
    // Container default for poles without override
    expect(c.frameDefaults?.poleMaterial).toBe('Wood');
  });
});

describe('Override Resolution (pure function)', () => {
  beforeEach(() => resetStore());

  it('FSA-8: resolveFrameProperty cascades element > frameDefaults > theme', () => {
    // Import the resolver from frameMaterials
    const { resolveFrameProperty } = require('@/config/frameMaterials');
    const defaults = { poleMaterial: 'Wood', poleShape: 'Square' };
    const override = { material: 'Concrete' };
    // Element override wins for material
    expect(resolveFrameProperty(override, defaults, 'pole', 'material')).toBe('Concrete');
    // No shape override → falls back to frameDefaults
    expect(resolveFrameProperty(override, defaults, 'pole', 'shape')).toBe('Square');
    // No override at all → falls back to theme default
    expect(resolveFrameProperty(undefined, undefined, 'pole', 'material')).toBe('Steel');
  });

  it('FSA-9: resolveFrameProperty works for rails', () => {
    const { resolveFrameProperty } = require('@/config/frameMaterials');
    const defaults = { railMaterial: 'Aluminum' };
    expect(resolveFrameProperty(undefined, defaults, 'rail', 'material')).toBe('Aluminum');
    expect(resolveFrameProperty(undefined, undefined, 'rail', 'shape')).toBe('Round');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/frame-data-model.test.ts`
Expected: FAIL — `setFrameDefaults` is not a function

- [ ] **Step 3: Add store actions to containerSlice.ts**

Find the `ContainerSlice` interface in `src/store/slices/containerSlice.ts` and add these action signatures:

```typescript
  setFrameDefaults: (containerId: string, defaults: Partial<NonNullable<Container['frameDefaults']>>) => void;
  setFrameElementOverride: (containerId: string, key: string, config: ElementConfig | PoleConfig) => void;
  clearFrameElementOverride: (containerId: string, key: string) => void;
  batchSetFrameOverrides: (containerId: string, keys: string[], config: ElementConfig | PoleConfig) => void;
```

Add the implementations in the slice body:

```typescript
  setFrameDefaults: (containerId, defaults) => {
    set((s: any) => {
      const c = s.containers[containerId];
      if (!c) return {};
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...c,
            frameDefaults: { ...c.frameDefaults, ...defaults },
          },
        },
      };
    });
  },

  setFrameElementOverride: (containerId, key, config) => {
    set((s: any) => {
      const c = s.containers[containerId];
      if (!c) return {};
      const isPole = key.startsWith('l');
      if (isPole) {
        return {
          containers: {
            ...s.containers,
            [containerId]: {
              ...c,
              poleOverrides: { ...c.poleOverrides, [key]: config },
            },
          },
        };
      } else {
        return {
          containers: {
            ...s.containers,
            [containerId]: {
              ...c,
              railOverrides: { ...c.railOverrides, [key]: config },
            },
          },
        };
      }
    });
  },

  clearFrameElementOverride: (containerId, key) => {
    set((s: any) => {
      const c = s.containers[containerId];
      if (!c) return {};
      const isPole = key.startsWith('l');
      if (isPole) {
        const { [key]: _, ...rest } = c.poleOverrides ?? {};
        return {
          containers: {
            ...s.containers,
            [containerId]: {
              ...c,
              poleOverrides: Object.keys(rest).length > 0 ? rest : undefined,
            },
          },
        };
      } else {
        const { [key]: _, ...rest } = c.railOverrides ?? {};
        return {
          containers: {
            ...s.containers,
            [containerId]: {
              ...c,
              railOverrides: Object.keys(rest).length > 0 ? rest : undefined,
            },
          },
        };
      }
    });
  },

  batchSetFrameOverrides: (containerId, keys, config) => {
    set((s: any) => {
      const c = s.containers[containerId];
      if (!c) return {};
      const newPoleOverrides = { ...c.poleOverrides };
      const newRailOverrides = { ...c.railOverrides };
      for (const key of keys) {
        if (key.startsWith('l')) {
          newPoleOverrides[key] = config;
        } else {
          newRailOverrides[key] = config;
        }
      }
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...c,
            poleOverrides: Object.keys(newPoleOverrides).length > 0 ? newPoleOverrides : undefined,
            railOverrides: Object.keys(newRailOverrides).length > 0 ? newRailOverrides : undefined,
          },
        },
      };
    });
  },
```

Import `ElementConfig` and `PoleConfig` from `@/types/container` at the top of containerSlice.ts.

- [ ] **Step 4: Update useStore.ts persistence**

In `src/store/useStore.ts`, find the `partialize` function inside the persist config. The `cleanContainers` loop that strips ephemeral fields needs to preserve `frameDefaults`, `poleOverrides`, and `railOverrides` (they are user intent — persisted). These fields are NOT stripped, so no change needed unless `poleDefaults` is currently being persisted — in that case, remove `poleDefaults` from persistence.

Also add `frameMode` and `selectedFrameElement` to the `StoreInvalidator` component (search for `StoreInvalidator` in `Scene.tsx` or wherever demand-mode invalidation is handled). Subscribe to `frameMode` changes and call `invalidate()`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/frame-data-model.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: Run full test suite for regressions**

Run: `npx vitest run`
Expected: All 375+ tests pass

- [ ] **Step 7: Commit**

```bash
git add src/store/slices/containerSlice.ts src/store/useStore.ts src/__tests__/frame-data-model.test.ts
git commit -m "feat: add frame store actions (setFrameDefaults, overrides, batch)"
```

---

## Task 4: UI State — frameMode and selectedFrameElement

**Files:**
- Modify: `src/store/slices/uiSlice.ts`

- [ ] **Step 1: Add frameMode and selectedFrameElement to UiSlice interface**

In `src/store/slices/uiSlice.ts`, add to the `UiSlice` interface (after line 64, near `inspectorView`):

```typescript
  // Frame Mode: shows structural skeleton, enables frame element interaction
  frameMode: boolean;
  toggleFrameMode: () => void;
  setFrameMode: (on: boolean) => void;

  // Selected frame element (pole or rail) in Frame Mode
  selectedFrameElement: { containerId: string; key: string; type: 'pole' | 'rail' } | null;
  setSelectedFrameElement: (el: { containerId: string; key: string; type: 'pole' | 'rail' } | null) => void;
```

- [ ] **Step 2: Add initial state and actions**

In the `createUiSlice` function, after the `inspectorView` lines (after line 137):

```typescript
  frameMode: false,
  toggleFrameMode: () => set((s: any) => ({
    frameMode: !s.frameMode,
    selectedFrameElement: null, // clear selection on toggle
  })),
  setFrameMode: (on) => set({
    frameMode: on,
    ...(!on ? { selectedFrameElement: null } : {}), // clear selection when turning off
  }),

  selectedFrameElement: null,
  setSelectedFrameElement: (el) => set({ selectedFrameElement: el }),
```

Additionally, in `src/store/slices/containerSlice.ts`, find the `removeContainer` action. After removing the container from state, add a guard to clear `selectedFrameElement` if it references the removed container:

```typescript
// Inside removeContainer, after deleting the container:
if (s.selectedFrameElement?.containerId === containerId) {
  return { ...result, selectedFrameElement: null };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/store/slices/uiSlice.ts
git commit -m "feat: add frameMode and selectedFrameElement to UI state"
```

---

## Task 5: View Isolation — Pure Function

**Files:**
- Create: `src/utils/viewIsolation.ts`
- Create: `src/__tests__/view-isolation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/view-isolation.test.ts
import { describe, it, expect } from 'vitest';
import { getViewOpacity } from '@/utils/viewIsolation';

describe('View Isolation: getViewOpacity', () => {
  // Default state: floor active, frame off
  it('VI-1: floor+noFrame → floor faces full, ceiling faces faded, frame background', () => {
    expect(getViewOpacity('floor-face', 'floor', false)).toBe(1.0);
    expect(getViewOpacity('ceiling-face', 'floor', false)).toBeCloseTo(0.15);
    expect(getViewOpacity('frame', 'floor', false)).toBeCloseTo(0.3);
  });

  it('VI-2: ceiling+noFrame → ceiling faces full, floor faces faded, frame background', () => {
    expect(getViewOpacity('floor-face', 'ceiling', false)).toBeCloseTo(0.15);
    expect(getViewOpacity('ceiling-face', 'ceiling', false)).toBe(1.0);
    expect(getViewOpacity('frame', 'ceiling', false)).toBeCloseTo(0.3);
  });

  it('VI-3: floor+frame → floor faces reduced, frame full', () => {
    expect(getViewOpacity('floor-face', 'floor', true)).toBeCloseTo(0.4);
    expect(getViewOpacity('ceiling-face', 'floor', true)).toBeCloseTo(0.1);
    expect(getViewOpacity('frame', 'floor', true)).toBe(1.0);
  });

  it('VI-4: ceiling+frame → ceiling faces reduced, frame full', () => {
    expect(getViewOpacity('floor-face', 'ceiling', true)).toBeCloseTo(0.1);
    expect(getViewOpacity('ceiling-face', 'ceiling', true)).toBeCloseTo(0.4);
    expect(getViewOpacity('frame', 'ceiling', true)).toBe(1.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/view-isolation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the pure function**

```typescript
// src/utils/viewIsolation.ts

/** Element types for opacity calculation */
export type ViewElementType = 'floor-face' | 'ceiling-face' | 'frame';

/** Tunable opacity constants */
const OPACITY = {
  FULL: 1.0,
  ACTIVE_WITH_FRAME: 0.4,   // active face when frame mode is on
  INACTIVE_FACE: 0.15,       // non-active face (floor when ceiling selected, etc.)
  INACTIVE_WITH_FRAME: 0.1,  // non-active face when frame mode steals focus
  FRAME_BACKGROUND: 0.3,     // frame when not in frame mode
} as const;

/**
 * Compute opacity for a given element type based on current view toggles.
 *
 * @param elementType - 'floor-face' | 'ceiling-face' | 'frame'
 * @param inspectorView - 'floor' | 'ceiling' (mutually exclusive, one always active)
 * @param frameMode - whether Frame Mode is on
 * @returns opacity value 0.0–1.0
 */
export function getViewOpacity(
  elementType: ViewElementType,
  inspectorView: 'floor' | 'ceiling',
  frameMode: boolean,
): number {
  if (elementType === 'frame') {
    return frameMode ? OPACITY.FULL : OPACITY.FRAME_BACKGROUND;
  }

  const isActive = (elementType === 'floor-face' && inspectorView === 'floor')
    || (elementType === 'ceiling-face' && inspectorView === 'ceiling');

  if (frameMode) {
    return isActive ? OPACITY.ACTIVE_WITH_FRAME : OPACITY.INACTIVE_WITH_FRAME;
  }
  return isActive ? OPACITY.FULL : OPACITY.INACTIVE_FACE;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/view-isolation.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/viewIsolation.ts src/__tests__/view-isolation.test.ts
git commit -m "feat: add view isolation opacity function (4 toggle states)"
```

---

## Task 6: Frame Toggle Button in Toolbar

**Files:**
- Modify: `src/components/ui/TopToolbar.tsx`

- [ ] **Step 1: Add Frame toggle button**

In `src/components/ui/TopToolbar.tsx`, add a selector for `frameMode` and `toggleFrameMode` (near line 85-86 where `inspectorView` is selected):

```typescript
const frameMode = useStore((s) => s.frameMode);
const toggleFrameMode = useStore((s) => s.toggleFrameMode);
```

After the Floor/Ceiling pill `<div>` (around line 279), add the Frame toggle:

```typescript
{/* ── Frame toggle ── */}
<button
  onClick={toggleFrameMode}
  title="Toggle Frame Mode"
  style={{
    padding: "5px 10px",
    border: `1px solid ${frameMode ? 'var(--accent, #2563eb)' : 'var(--btn-border, #e5e7eb)'}`,
    borderRadius: 6,
    cursor: "pointer",
    background: frameMode ? "var(--accent, #2563eb)" : "transparent",
    color: frameMode ? "#fff" : "var(--text-muted, #6b7280)",
    fontSize: 11,
    fontWeight: 600,
    marginLeft: 4,
    transition: "all 100ms",
  }}
>
  Frame
</button>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/TopToolbar.tsx
git commit -m "feat: add Frame toggle button to toolbar"
```

---

## Task 7: View Isolation in 3D Rendering

**Files:**
- Modify: `src/components/objects/ContainerSkin.tsx`
- Modify: `src/components/three/ContainerMesh.tsx`

- [ ] **Step 1: Wire view isolation opacity into ContainerSkin.tsx**

In `src/components/objects/ContainerSkin.tsx`, add imports:

```typescript
import { getViewOpacity } from '@/utils/viewIsolation';
```

Add selectors (near the top of the component, with other store selectors):

```typescript
const frameMode = useStore((s) => s.frameMode);
const inspectorView = useStore((s) => s.inspectorView);
```

Find where voxel face meshes are rendered and apply opacity based on view isolation. The key change: when `frameMode` is true, all voxel face meshes get reduced opacity and disabled raycast. Apply `getViewOpacity('floor-face', inspectorView, frameMode)` to floor-level faces and `getViewOpacity('ceiling-face', inspectorView, frameMode)` to ceiling-level faces.

For the `pillarPositions` rendering (around line 2985-3003), add override lookup:

```typescript
// Before rendering each pole, check poleOverrides
const poleKey = `l0r${pole.row}c${pole.col}_${pole.corner}`;
const poleOverride = container.poleOverrides?.[poleKey];
if (poleOverride?.visible === false) return null; // hidden by user
// Use poleOverride?.material ?? container.frameDefaults?.poleMaterial ?? 'Steel'
// Use poleOverride?.shape ?? container.frameDefaults?.poleShape ?? 'Round'
```

When `frameMode` is true, enable raycast on pole meshes (remove `raycast={nullRaycast}`) and add hover/click handlers.

- [ ] **Step 2: Wire view isolation into ContainerMesh.tsx frame elements**

In `src/components/three/ContainerMesh.tsx`, add selectors:

```typescript
const frameMode = useStore((s) => s.frameMode);
const inspectorView = useStore((s) => s.inspectorView);
const selectedFrameElement = useStore((s) => s.selectedFrameElement);
const setSelectedFrameElement = useStore((s) => s.setSelectedFrameElement);
```

Apply `getViewOpacity('frame', inspectorView, frameMode)` to frame material opacity. When `frameMode` is true:
- Frame meshes get full opacity and raycast enabled
- Add `onPointerOver`/`onPointerOut` handlers for amber hover highlight
- Add `onClick` handlers that call `setSelectedFrameElement`
- Selected element gets cyan highlight material

When `frameMode` is false:
- Frame meshes get `getViewOpacity('frame', ...)` opacity
- `raycast={() => {}}` on all frame meshes

Add `onPointerMissed` deselection: in the Canvas or scene root (where `onPointerMissed` already clears voxel selection), also clear `selectedFrameElement` when `frameMode` is on:

```typescript
// In the existing onPointerMissed handler (Scene.tsx or CanvasWrapper):
if (frameMode) {
  setSelectedFrameElement(null);
}
```

- [ ] **Step 3: Add demand-mode invalidation**

Find `StoreInvalidator` (search codebase). Add `frameMode` and `selectedFrameElement` to watched state. Call `invalidate()` when they change.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/objects/ContainerSkin.tsx src/components/three/ContainerMesh.tsx
git commit -m "feat: wire view isolation opacity and frame mode interaction to 3D"
```

---

## Task 8: Frame Inspector Panel

**Files:**
- Create: `src/components/ui/FrameInspector.tsx`
- Modify: `src/components/ui/Sidebar.tsx`

- [ ] **Step 1: Create FrameInspector component**

```typescript
// src/components/ui/FrameInspector.tsx
'use client';
import { useStore } from '@/store/useStore';
import { POLE_MATERIALS, POLE_SHAPES, RAIL_MATERIALS, RAIL_SHAPES, DEFAULT_FRAME_CONFIG } from '@/config/frameMaterials';

/** Frame element detail view + container-level defaults */
export function FrameInspector({ containerId }: { containerId: string }) {
  const container = useStore((s) => s.containers[containerId]);
  const selectedFrameElement = useStore((s) => s.selectedFrameElement);
  const setFrameDefaults = useStore((s) => s.setFrameDefaults);
  const setFrameElementOverride = useStore((s) => s.setFrameElementOverride);
  const clearFrameElementOverride = useStore((s) => s.clearFrameElementOverride);

  if (!container) return null;

  const defaults = container.frameDefaults ?? {};
  const sel = selectedFrameElement?.containerId === containerId ? selectedFrameElement : null;

  // Get current override for selected element
  const override = sel
    ? sel.type === 'pole'
      ? container.poleOverrides?.[sel.key]
      : container.railOverrides?.[sel.key]
    : null;

  const materials = sel?.type === 'pole' ? POLE_MATERIALS : RAIL_MATERIALS;
  const shapes = sel?.type === 'pole' ? POLE_SHAPES : RAIL_SHAPES;

  const currentMaterial = override?.material
    ?? (sel?.type === 'pole' ? defaults.poleMaterial : defaults.railMaterial)
    ?? (sel?.type === 'pole' ? DEFAULT_FRAME_CONFIG.poleMaterial : DEFAULT_FRAME_CONFIG.railMaterial);

  const currentShape = override?.shape
    ?? (sel?.type === 'pole' ? defaults.poleShape : defaults.railShape)
    ?? (sel?.type === 'pole' ? DEFAULT_FRAME_CONFIG.poleShape : DEFAULT_FRAME_CONFIG.railShape);

  const isVisible = override?.visible !== false;

  // Generate human-readable label
  const label = sel
    ? sel.type === 'pole'
      ? `Pole at ${sel.key.replace(/^l\d+/, '').replace(/r(\d+)c(\d+)_(\w+)/, 'R$1 C$2 ($3)')}`
      : `Rail ${sel.key.replace(/r(\d+)c(\d+)_(\w)/, 'R$1 C$2 ($3)')}`
    : null;

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      {sel && label ? (
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{label}</div>

          {/* Visibility toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setFrameElementOverride(containerId, sel.key, { ...override, visible: e.target.checked })}
            />
            Visible
          </label>

          {/* Material dropdown */}
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Material</label>
            <select
              value={currentMaterial}
              onChange={(e) => setFrameElementOverride(containerId, sel.key, { ...override, material: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {materials.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Shape dropdown */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Shape</label>
            <select
              value={currentShape}
              onChange={(e) => setFrameElementOverride(containerId, sel.key, { ...override, shape: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {shapes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Reset button */}
          <button
            onClick={() => clearFrameElementOverride(containerId, sel.key)}
            style={{ fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}
          >
            Reset to Default
          </button>
        </>
      ) : (
        <>
          {/* Container-level frame defaults */}
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Frame Defaults</div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Pole Material</label>
            <select
              value={defaults.poleMaterial ?? DEFAULT_FRAME_CONFIG.poleMaterial}
              onChange={(e) => setFrameDefaults(containerId, { poleMaterial: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {POLE_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Pole Shape</label>
            <select
              value={defaults.poleShape ?? DEFAULT_FRAME_CONFIG.poleShape}
              onChange={(e) => setFrameDefaults(containerId, { poleShape: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {POLE_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Rail Material</label>
            <select
              value={defaults.railMaterial ?? DEFAULT_FRAME_CONFIG.railMaterial}
              onChange={(e) => setFrameDefaults(containerId, { railMaterial: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {RAIL_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Rail Shape</label>
            <select
              value={defaults.railShape ?? DEFAULT_FRAME_CONFIG.railShape}
              onChange={(e) => setFrameDefaults(containerId, { railShape: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {RAIL_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire FrameInspector into Sidebar.tsx**

In `src/components/ui/Sidebar.tsx` (876 lines), find the inspector section (State B — shown when a container is selected). The inspector currently renders MatrixEditor + VoxelPreview3D around line 500. Add a conditional that routes to FrameInspector when `frameMode` is true:

```typescript
import { FrameInspector } from './FrameInspector';

// Add selector near other store selectors:
const frameMode = useStore((s) => s.frameMode);

// In State B (inspector), wrap existing MatrixEditor/VoxelPreview3D:
{frameMode ? (
  <FrameInspector containerId={selectedId} />
) : (
  // existing MatrixEditor + VoxelPreview3D code
)}
```

When `frameMode` is true, the FrameInspector replaces the Container Grid and voxel preview. The MatrixEditor still handles its own Frame Mode routing for the 2D grid overlay (Task 9).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/FrameInspector.tsx src/components/ui/Sidebar.tsx
git commit -m "feat: add FrameInspector panel for pole/rail config"
```

---

## Task 9: Frame Mode 2D Grid (SVG Overlay)

**Files:**
- Modify: `src/components/ui/MatrixEditor.tsx`

- [ ] **Step 1: Add Frame Mode SVG overlay to MatrixEditor**

In `src/components/ui/MatrixEditor.tsx`, add a selector for `frameMode`:

```typescript
const frameMode = useStore((s) => s.frameMode);
const selectedFrameElement = useStore((s) => s.selectedFrameElement);
const setSelectedFrameElement = useStore((s) => s.setSelectedFrameElement);
```

When `frameMode === true`, render a **frame grid overlay** instead of the normal voxel/bay grid. This overlay is an SVG with:

- Grid lines rendered as visible strokes (the structural rails)
- `<rect>` hit targets (~8px wide) along each edge for rail selection
- `<circle>` hit targets (~12px diameter) at each intersection for pole selection
- Hover: amber stroke/fill on `onMouseEnter`
- Click: calls `setSelectedFrameElement({ containerId, key, type })`
- Selected element: cyan highlight
- Hidden elements (from overrides): dashed stroke / hollow circle

The grid dimensions should match the existing voxel grid layout (4 rows × 8 cols). Use the same coordinate system as the existing SVG grid.

Add the conditional render before the existing grid code (around line 843):

```typescript
{frameMode ? (
  <FrameGridOverlay containerId={containerId} level={gridLevel} />
) : designComplexity === 'simple' ? (
  <SimpleBayGrid container={container} containerId={containerId} level={gridLevel} />
) : (
  // DetailedVoxelGrid
)}
```

Implement `FrameGridOverlay` as a local component or extract to its own file if it exceeds ~100 lines. It needs:
- VOXEL_ROWS (4) and VOXEL_COLS (8) for grid dimensions
- Cell size calculations matching existing grid
- SVG `<line>` elements for grid structure
- SVG `<rect>` elements for rail hit targets (invisible, positioned over grid lines)
- SVG `<circle>` elements for pole hit targets (visible dots at intersections)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/MatrixEditor.tsx
git commit -m "feat: add Frame Mode 2D grid with rail/pole hit targets"
```

---

## Task 10: 2D Bay Mode Tests + Grid (Simple Complexity)

**Files:**
- Create: `src/__tests__/bay-mode.test.ts`
- Modify: `src/components/ui/MatrixEditor.tsx`

- [ ] **Step 1: Write bay mode tests**

```typescript
// src/__tests__/bay-mode.test.ts
import { describe, it, expect } from 'vitest';
import { computeBayGroups, getBayGroupForVoxel, getBayIndicesForVoxel } from '@/config/bayGroups';
import { VOXEL_ROWS, VOXEL_COLS } from '@/types/container';

describe('Bay Mode: Bay Grouping', () => {
  it('BAY-1: computeBayGroups returns exactly 15 groups', () => {
    const groups = computeBayGroups();
    expect(groups).toHaveLength(15);
  });

  it('BAY-2: All 32 voxels are covered exactly once', () => {
    const groups = computeBayGroups();
    const allIndices = groups.flatMap((g) => g.voxelIndices);
    expect(allIndices).toHaveLength(VOXEL_ROWS * VOXEL_COLS); // 32
    expect(new Set(allIndices).size).toBe(32); // no duplicates
  });

  it('BAY-3: Each group has gridRow, gridCol, rowSpan, colSpan for CSS Grid', () => {
    const groups = computeBayGroups();
    for (const g of groups) {
      expect(g.gridRow).toBeGreaterThanOrEqual(1);
      expect(g.gridCol).toBeGreaterThanOrEqual(1);
      expect(g.rowSpan).toBeGreaterThanOrEqual(1);
      expect(g.colSpan).toBeGreaterThanOrEqual(1);
      expect(g.label).toBeTruthy();
    }
  });

  it('BAY-4: getBayGroupForVoxel returns correct group for body voxel', () => {
    // Voxel 9 (row 1, col 1) should be in a body group
    const group = getBayGroupForVoxel(9, VOXEL_ROWS * VOXEL_COLS);
    expect(group).toBeDefined();
    expect(group!.role).toBe('body');
    expect(group!.voxelIndices).toContain(9);
  });

  it('BAY-5: getBayGroupForVoxel returns correct group for corner voxel', () => {
    // Voxel 0 (row 0, col 0) should be in a corner group
    const group = getBayGroupForVoxel(0, VOXEL_ROWS * VOXEL_COLS);
    expect(group).toBeDefined();
    expect(group!.role).toBe('corner');
  });

  it('BAY-6: getBayIndicesForVoxel returns all voxels in the same bay', () => {
    const indices = getBayIndicesForVoxel(9, VOXEL_ROWS * VOXEL_COLS);
    expect(indices).toBeDefined();
    expect(indices!.length).toBeGreaterThanOrEqual(2); // body groups have 4 voxels
    expect(indices).toContain(9);
  });

  it('BAY-7: computeBayGroups groups match grid layout (no gaps, no overlaps in CSS Grid)', () => {
    const groups = computeBayGroups();
    // Verify all groups fit within the expected CSS Grid bounds
    for (const g of groups) {
      expect(g.gridRow + g.rowSpan - 1).toBeLessThanOrEqual(VOXEL_ROWS);
      expect(g.gridCol + g.colSpan - 1).toBeLessThanOrEqual(VOXEL_COLS);
    }
    // Verify every grid cell is covered by exactly one bay group
    const cellCoverage = new Map<string, string>();
    for (const g of groups) {
      for (let r = g.gridRow; r < g.gridRow + g.rowSpan; r++) {
        for (let c = g.gridCol; c < g.gridCol + g.colSpan; c++) {
          const key = `${r},${c}`;
          expect(cellCoverage.has(key)).toBe(false); // no overlap
          cellCoverage.set(key, g.id);
        }
      }
    }
    // All 32 grid cells (4 rows × 8 cols) should be covered
    expect(cellCoverage.size).toBe(VOXEL_ROWS * VOXEL_COLS);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/bay-mode.test.ts`
Expected: PASS (7 tests) — these verify existing `computeBayGroups()` logic

- [ ] **Step 3: Verify SimpleBayGrid exists and renders 15 bays**

Check if `SimpleBayGrid` component already exists in `MatrixEditor.tsx` (around line 843-845). If it exists but renders 32 cells, update it. If it already renders 15 bays correctly, this step is done.

The component should:
- Call `computeBayGroups()` to get 15 bay groups
- Render a CSS Grid with `grid-template-rows: repeat(3, 1fr)` and `grid-template-columns` sized proportionally (corners smaller, body quads larger)
- Each bay cell uses `gridRow`/`gridCol`/`rowSpan`/`colSpan` from `BayGroup`
- Cell shows `BayGroup.label` and dominant surface color
- Click interior → select bay (set `selectedVoxels` to bay's `voxelIndices`)
- Click edge → select bay wall face for painting

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/bay-mode.test.ts src/components/ui/MatrixEditor.tsx
git commit -m "feat: bay mode tests + SimpleBayGrid renders 15 bays"
```

---

## Task 11: Adjacent Railing Merge Verification

**Files:**
- Create: `src/__tests__/railing-merge.test.ts`

- [ ] **Step 1: Write merge verification tests**

```typescript
// src/__tests__/railing-merge.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve(); }),
    del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  };
});

import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

function addContainer(): string {
  return useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
}

function getVoxel(containerId: string, index: number) {
  return useStore.getState().containers[containerId].voxelGrid![index];
}

describe('Adjacent Railing Merge Verification', () => {
  beforeEach(() => resetStore());

  it('MERGE-1: Two adjacent open-air voxels both get auto-railing on exterior faces', () => {
    const id = addContainer();
    // Make voxels 9 and 10 (row 1, cols 1-2) open-air
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 10, 'top', 'Open');
    // Both should have auto-railings on their exposed (non-shared) faces
    // Shared face between 9 and 10 should NOT have railing (neighbor is active)
    const v9 = getVoxel(id, 9);
    const v10 = getVoxel(id, 10);
    // v9 face 'n' → row 0 (inactive) → railing
    expect(v9.faces.n).toBe('Railing_Cable');
    // v10 face 'n' → row 0 (inactive) → railing
    expect(v10.faces.n).toBe('Railing_Cable');
  });

  it('MERGE-2: Shared face between two adjacent open-air voxels does NOT get railing', () => {
    const id = addContainer();
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 10, 'top', 'Open');
    // Voxel 9 (col 1) east neighbor is voxel 10 (col 2) — both active
    // e: dc=-1 means face 'e' checks col-1 (for voxel 10 that's voxel 9, active)
    // w: dc=+1 means face 'w' checks col+1 (for voxel 9 that's voxel 10, active)
    // Shared faces should NOT have railing — both neighbors are active open-air
    const v9 = getVoxel(id, 9);
    const v10 = getVoxel(id, 10);
    // v9 west face → neighbor at col+1 (voxel 10) is active → no railing
    expect(v9.faces.w).not.toMatch(/^Railing_/);
    // v10 east face → neighbor at col-1 (voxel 9) is active → no railing
    expect(v10.faces.e).not.toMatch(/^Railing_/);
  });

  it('MERGE-3: Mixed railing types preserve separate identity', () => {
    const id = addContainer();
    // Make voxels 9, 10 open-air
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 10, 'top', 'Open');
    // Manually paint voxel 10's north face to Glass railing
    useStore.getState().setVoxelFace(id, 10, 'n', 'Railing_Glass');
    // v9 should still have Cable, v10 should have Glass
    expect(getVoxel(id, 9).faces.n).toBe('Railing_Cable');
    expect(getVoxel(id, 10).faces.n).toBe('Railing_Glass');
  });

  it('MERGE-4: Auto-railing respects bay group boundaries', () => {
    const id = addContainer();
    // Make body voxels 9, 10, 11 open-air (cols 1, 2, 3 in row 1)
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 10, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 11, 'top', 'Open');
    // All three should have consistent auto-railing on exposed faces
    for (const idx of [9, 10, 11]) {
      const v = getVoxel(id, idx);
      expect(v.faces.n).toBe('Railing_Cable'); // north = row 0 (inactive)
    }
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/__tests__/railing-merge.test.ts`
Expected: PASS (4 tests) — these verify existing behavior, not new code

- [ ] **Step 3: If any test fails, investigate and fix**

The auto-railing system (`recomputeSmartRailings`) should handle adjacency correctly. If tests fail, trace the issue using the systematic-debugging skill before applying fixes.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/railing-merge.test.ts
git commit -m "test: add adjacent railing merge verification tests"
```

---

## Task 12: Final Integration Verification

**Files:** None new — verification only.

- [ ] **Step 0: Run /simplify**

Run: `/simplify`
Review changed code for reuse, quality, and efficiency. Fix any issues found.

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (375+ existing + ~20 new)

- [ ] **Step 3: Browser verification checklist**

Start dev server: `npm run dev`

Verify in browser:
1. Floor/Ceiling toggle works as before
2. Frame toggle button appears, toggles on/off
3. When Frame ON: voxel faces fade, frame elements become prominent
4. When Frame ON: hovering a post/rail shows amber highlight
5. When Frame ON: clicking a post/rail shows cyan selection, Inspector shows config
6. Frame Inspector: dropdowns for material/shape work, visibility toggle works, Reset clears override
7. When Frame OFF: normal behavior restored, frame faded to background
8. 2D Container Grid in Frame Mode: edges and intersections are clickable
9. Simple mode Container Grid: shows 15 bay cells (if SimpleBayGrid was updated)

- [ ] **Step 4: Commit any browser-discovered fixes**

```bash
git add -u
git commit -m "fix: address browser verification issues"
```

- [ ] **Step 5: Final commit — tag phase complete**

```bash
git tag -a phase2-complete -m "Phase 2 Smart Architecture complete: frame mode, view isolation, bay grid"
```
