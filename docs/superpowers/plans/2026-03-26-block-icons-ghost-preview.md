# Block Icons & Material Ghost Preview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat-fill block icons with PBR-textured thumbnails, implement material-accurate ghost previews across all tabs, and add pop-and-shrink click feedback in the 3D scene.

**Architecture:** Four sequential layers — (1) fix Gull-Wing crash, (2) add MaterialDef type + expand ghostPreset store, (3) build OffscreenCanvas thumbnail renderer, (4) rewrite PresetGhost with material-accurate clones + pop animation. Each layer commits independently and passes tests before the next begins.

**Tech Stack:** React 19, Three.js, R3F (react-three-fiber), Zustand 5, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-03-25-block-icons-ghost-preview-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/container.ts` | Modify | Add `MaterialDef` interface |
| `src/store/slices/uiSlice.ts` | Modify | Expand `ghostPreset` type, add `ghostPopActive`/`ghostPopStartTime`, new actions |
| `src/components/objects/ContainerSkin.tsx` | Modify | Investigate + fix Gull-Wing crash |
| `src/components/objects/HoverPreviewGhost.tsx` | Modify | Rewrite PresetGhost with material clones + pop animation |
| `src/utils/ghostMaterial.ts` | Create | `createGhostMaterial()` with WeakMap cache |
| `src/components/ui/finishes/BlockThumbnailRenderer.tsx` | Create | Hidden R3F Canvas for thumbnail capture |
| `src/components/ui/finishes/BlockThumbnailContext.tsx` | Create | React context + `useBlockThumbnail()` hook |
| `src/components/ui/finishes/BlockTab.tsx` | Modify | Use thumbnail images, set `materialMap` on hover |
| `src/components/ui/finishes/VariantGrid.tsx` | Modify | Set `materialMap` on hover |
| `src/components/ui/finishes/FlooringTab.tsx` | Modify | Set `materialMap.bottom` on hover |
| `src/components/ui/finishes/CeilingTab.tsx` | Modify | Set `materialMap.top` on hover |
| `src/__tests__/gull-wing-regression.test.ts` | Create | Regression test for Gull-Wing |
| `src/__tests__/ghost-material.test.ts` | Create | Tests for createGhostMaterial WeakMap cache |
| `src/__tests__/ghost-pop-lifecycle.test.ts` | Create | Tests for ghostPopActive store lifecycle |
| `src/__tests__/material-def.test.ts` | Create | Tests for MaterialDef type shape |

---

### Task 1: Investigate & Fix Gull-Wing Crash

**Files:**
- Investigate: `src/components/objects/ContainerSkin.tsx:519-544` (GullWingFace)
- Investigate: `src/components/objects/ContainerMesh.tsx:826+` (HingedBayGullWing)
- Investigate: `src/config/materialCache.ts:247-298` (getMaterialForFace)
- Test: `src/__tests__/gull-wing-regression.test.ts`

**Context:** The Gull-Wing preset (`gull_wing` in blockPresets.ts) sets faces `{top:'Open', bottom:'Deck_Wood', n:'Gull_Wing', s:'Gull_Wing', e:'Solid_Steel', w:'Solid_Steel'}`. GullWingFace exists at ContainerSkin.tsx:519 and is mapped at line 892. The crash (black screen) occurs at runtime — likely a material or geometry error in the R3F render loop. The scene going fully black indicates an uncaught exception in the Three.js animation frame.

- [ ] **Step 1: Reproduce the crash**

Open the app in browser. Select a container. Go to Block tab. Click "Gull-Wing" preset. Observe black screen. Open browser console — capture the exact error message and stack trace.

- [ ] **Step 2: Identify root cause from error**

Based on the error, trace through: ContainerSkin.tsx:892 (renderFaceGeometry switch case for 'Gull_Wing'), GullWingFace component (lines 519-544), and the material it uses (`mFrame` at line 539 — verify this is defined and non-null in the current scope). Check if `SteelFace` (called inside GullWingFace) receives valid dimensions.

- [ ] **Step 3: Write regression test**

```typescript
// src/__tests__/gull-wing-regression.test.ts
import { describe, it, expect } from 'vitest';
import { useStore } from '@/store/useStore';
import { BLOCK_PRESETS } from '@/config/blockPresets';

describe('Gull-Wing block preset', () => {
  it('gull_wing preset exists with valid faces', () => {
    const preset = BLOCK_PRESETS.find(p => p.id === 'gull_wing');
    expect(preset).toBeDefined();
    expect(preset!.faces.n).toBe('Gull_Wing');
    expect(preset!.faces.s).toBe('Gull_Wing');
  });

  it('applyBlockConfig with gull_wing does not throw', () => {
    const store = useStore.getState();
    const cid = store.addContainer('40ft');
    expect(cid).toBeTruthy();
    // Apply gull_wing to first body voxel (index 9 = col1, row1, level0)
    expect(() => {
      store.applyBlockConfig(cid!, [9], 'gull_wing');
    }).not.toThrow();
    const voxel = store.containers[cid!].voxelGrid![9];
    expect(voxel.faces.n).toBe('Gull_Wing');
  });
});
```

- [ ] **Step 4: Run test to verify it fails or passes**

Run: `npx vitest run src/__tests__/gull-wing-regression.test.ts -v`

If the test passes (applyBlockConfig doesn't throw), the crash is in the R3F render path, not the store. If it throws, the crash is in the store logic.

- [ ] **Step 5: Fix the crash**

Apply the fix based on the root cause identified in step 2. Common patterns:
- If `mFrame` is undefined: ensure GullWingFace accesses material from the correct scope (passed as prop or from module-level `_themeMats`)
- If geometry generation throws: add bounds checking on `w`, `h`, `d` parameters
- If the error is in ContainerMesh.tsx HingedBayGullWing: check for undefined voxelGrid access

- [ ] **Step 6: Verify fix in browser**

Reload app. Select container → Block tab → click Gull-Wing. Scene should NOT go black. The gull-wing face should render (even if static/non-animated).

- [ ] **Step 7: Run all tests**

Run: `npx vitest run -v`
Expected: All tests pass including the new regression test.

- [ ] **Step 8: Commit**

```bash
git add src/__tests__/gull-wing-regression.test.ts src/components/objects/ContainerSkin.tsx
git commit -m "fix: resolve Gull-Wing crash + add regression test"
```

---

### Task 2: Add MaterialDef Type + Expand ghostPreset Store

**Files:**
- Modify: `src/types/container.ts` (add MaterialDef)
- Modify: `src/store/slices/uiSlice.ts` (expand ghostPreset type, add pop fields)
- Test: `src/__tests__/material-def.test.ts`
- Test: `src/__tests__/ghost-pop-lifecycle.test.ts`

**Context:** `ghostPreset` currently has `{ source: 'block' | 'container'; faces: VoxelFaces; targetScope: 'voxel' | 'bay' | 'container' }`. We need to add `materialMap` and expand `source` to include `'walls' | 'flooring' | 'ceiling'`. We also add `ghostPopActive`/`ghostPopStartTime` for the click confirmation animation.

- [ ] **Step 1: Write MaterialDef type test**

```typescript
// src/__tests__/material-def.test.ts
import { describe, it, expect } from 'vitest';
import type { MaterialDef, SurfaceType } from '@/types/container';

describe('MaterialDef type', () => {
  it('accepts minimal shape (surfaceType only)', () => {
    const def: MaterialDef = { surfaceType: 'Solid_Steel' };
    expect(def.surfaceType).toBe('Solid_Steel');
    expect(def.textureId).toBeUndefined();
    expect(def.color).toBeUndefined();
    expect(def.finishMeta).toBeUndefined();
  });

  it('accepts full shape with all optional fields', () => {
    const def: MaterialDef = {
      surfaceType: 'Glass_Pane',
      textureId: 'glassPanel',
      color: '#88ccff',
      finishMeta: { glassTint: 'blue' },
    };
    expect(def.textureId).toBe('glassPanel');
    expect(def.finishMeta!.glassTint).toBe('blue');
  });
});
```

- [ ] **Step 2: Write ghostPopActive lifecycle test**

```typescript
// src/__tests__/ghost-pop-lifecycle.test.ts
import { describe, it, expect } from 'vitest';
import { useStore } from '@/store/useStore';

describe('ghostPopActive lifecycle', () => {
  it('triggerGhostPop sets active + startTime', () => {
    const store = useStore.getState();
    store.triggerGhostPop();
    const state = useStore.getState();
    expect(state.ghostPopActive).toBe(true);
    expect(state.ghostPopStartTime).toBeGreaterThan(0);
  });

  it('clearGhostPop resets active', () => {
    const store = useStore.getState();
    store.triggerGhostPop();
    store.clearGhostPop();
    const state = useStore.getState();
    expect(state.ghostPopActive).toBe(false);
  });

  it('ghostPreset source accepts all tab values', () => {
    const store = useStore.getState();
    const faces = { top: 'Open' as const, bottom: 'Deck_Wood' as const,
      n: 'Solid_Steel' as const, s: 'Solid_Steel' as const,
      e: 'Solid_Steel' as const, w: 'Solid_Steel' as const };
    for (const src of ['block', 'container', 'walls', 'flooring', 'ceiling'] as const) {
      store.setGhostPreset({ source: src, faces, targetScope: 'voxel' });
      expect(useStore.getState().ghostPreset!.source).toBe(src);
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/material-def.test.ts src/__tests__/ghost-pop-lifecycle.test.ts -v`
Expected: FAIL — `MaterialDef` not exported, `triggerGhostPop`/`clearGhostPop` don't exist, and TypeScript will reject `source: 'walls'` (not yet in the union). All expected failures.

- [ ] **Step 4: Add MaterialDef to container.ts**

In `src/types/container.ts`, after the `VoxelFaces` interface (~line 289), add:

```typescript
/** Material definition for ghost preview — maps surface type to concrete material properties. */
export interface MaterialDef {
  surfaceType: SurfaceType;
  /** Key into _themeMats texture cache (e.g., 'steelCorrugated', 'oakPlanks') */
  textureId?: string;
  /** Hex color override (e.g., '#78716c' for custom paint) */
  color?: string;
  /** Finish metadata — doorStyle, glassTint, etc. */
  finishMeta?: Record<string, string>;
}
```

- [ ] **Step 5: Expand ghostPreset type + add pop fields in uiSlice.ts**

In `src/store/slices/uiSlice.ts`:

1. Import `MaterialDef` from `@/types/container`
2. Update the `ghostPreset` type (around line 185):
```typescript
ghostPreset: {
  source: 'block' | 'container' | 'walls' | 'flooring' | 'ceiling';
  faces: VoxelFaces;
  targetScope: 'voxel' | 'bay' | 'container';
  materialMap?: Partial<Record<keyof VoxelFaces, MaterialDef>>;
} | null;
```
3. Add new state fields to the interface and initial state:
```typescript
ghostPopActive: boolean;       // default: false
ghostPopStartTime: number;     // default: 0
```
4. Add new actions:
```typescript
triggerGhostPop: () => set({
  ghostPopActive: true,
  ghostPopStartTime: performance.now(),
}),
clearGhostPop: () => set({ ghostPopActive: false }),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/material-def.test.ts src/__tests__/ghost-pop-lifecycle.test.ts -v`
Expected: All PASS.

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run -v`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/types/container.ts src/store/slices/uiSlice.ts \
  src/__tests__/material-def.test.ts src/__tests__/ghost-pop-lifecycle.test.ts
git commit -m "feat: add MaterialDef type, expand ghostPreset source union, add ghost pop lifecycle"
```

---

### Task 3: Create Ghost Material Utility

**Files:**
- Create: `src/utils/ghostMaterial.ts`
- Test: `src/__tests__/ghost-material.test.ts`

**Context:** `createGhostMaterial` clones a THREE.Material and makes it transparent (opacity 0.30, depthWrite false). Uses a WeakMap keyed on the original material instance — when themes change and `_themeMats` creates new material objects, old WeakMap entries are GC'd automatically.

- [ ] **Step 1: Write test**

```typescript
// src/__tests__/ghost-material.test.ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGhostMaterial } from '@/utils/ghostMaterial';

describe('createGhostMaterial', () => {
  it('returns transparent clone with 0.30 opacity', () => {
    const base = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const ghost = createGhostMaterial(base);
    expect(ghost).not.toBe(base);
    expect(ghost.transparent).toBe(true);
    expect(ghost.opacity).toBeCloseTo(0.30);
    expect(ghost.depthWrite).toBe(false);
  });

  it('caches — same base returns same clone', () => {
    const base = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const ghost1 = createGhostMaterial(base);
    const ghost2 = createGhostMaterial(base);
    expect(ghost1).toBe(ghost2);
  });

  it('different base materials return different clones', () => {
    const base1 = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const base2 = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    const ghost1 = createGhostMaterial(base1);
    const ghost2 = createGhostMaterial(base2);
    expect(ghost1).not.toBe(ghost2);
  });

  it('handles MeshPhysicalMaterial (glass)', () => {
    const base = new THREE.MeshPhysicalMaterial({ transmission: 0.9 });
    const ghost = createGhostMaterial(base);
    expect(ghost.transparent).toBe(true);
    expect(ghost.opacity).toBeCloseTo(0.30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/ghost-material.test.ts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement createGhostMaterial**

```typescript
// src/utils/ghostMaterial.ts
import * as THREE from 'three';

const GHOST_OPACITY = 0.30;

const _cache = new WeakMap<THREE.Material, THREE.Material>();

/**
 * Create a transparent clone of the given material for ghost preview rendering.
 * Cached by material reference (WeakMap) — theme changes auto-invalidate.
 */
export function createGhostMaterial(base: THREE.Material): THREE.Material {
  const cached = _cache.get(base);
  if (cached) return cached;

  const clone = base.clone();
  clone.transparent = true;
  clone.opacity = GHOST_OPACITY;
  clone.depthWrite = false;
  clone.side = THREE.DoubleSide;
  clone.needsUpdate = true;

  _cache.set(base, clone);
  return clone;
}

/** Update opacity on all cached ghost materials (for pulse animation). */
export function setGhostOpacity(opacity: number): void {
  // WeakMap is not iterable — callers must track active ghost materials
  // and set opacity directly. This is a placeholder for documentation.
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/ghost-material.test.ts -v`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/ghostMaterial.ts src/__tests__/ghost-material.test.ts
git commit -m "feat: add createGhostMaterial utility with WeakMap cache"
```

---

### Task 4: Rewrite PresetGhost with Material-Accurate Clones

**Files:**
- Modify: `src/components/objects/HoverPreviewGhost.tsx` (PresetGhost function, ~lines 177-306)

**Context:** Current PresetGhost uses flat `_ghostMats.solid`/`_ghostMats.glass`. Rewrite to read `ghostPreset.materialMap`, resolve each face's MaterialDef to an actual THREE.Material via `getMaterialForFace`, then clone it transparently via `createGhostMaterial`. Keep the existing pool architecture (48 meshes). Add pop animation driven by `ghostPopActive` + `ghostPopStartTime`.

**Key references:**
- `getMaterialForFace(surfaceType, finish, themeId)` in `src/config/materialCache.ts:247-298`
- `FACE_KEYS`, `FACE_RX`, `FACE_RY` constants at lines 173-175
- Pool meshes already exist: `getGhostPool()` returns 48 pre-allocated meshes
- `getVoxelLayout(col, row, dims)` from ContainerSkin for voxel positioning
- `getCachedPlane(w, h)` from `src/utils/geometryCache.ts` for face geometry

- [ ] **Step 1: Add imports**

At top of HoverPreviewGhost.tsx, add:
```typescript
import { createGhostMaterial } from '@/utils/ghostMaterial';
import { getMaterialForFace, _themeMats } from '@/config/materialCache';
```

- [ ] **Step 2: Rewrite PresetGhost useFrame material assignment**

In the `useFrame` callback that positions pool meshes (currently ~lines 240-290), replace the material assignment logic:

**Before:** Each mesh gets `_ghostMats.solid` or `_ghostMats.glass` based on GLASS_SURFACES set.

**After:**
```typescript
// Inside the face loop, after computing fc (face config):
const matDef = ghostPreset.materialMap?.[fc.face];
let faceMat: THREE.Material;

if (matDef) {
  // Material-accurate path: resolve MaterialDef → actual material → ghost clone
  // getMaterialForFace(surface, finish, theme) — 3 args
  const finish = matDef.finishMeta as import('@/config/materialCache').FaceFinish | undefined;
  const baseMat = getMaterialForFace(
    matDef.surfaceType, finish, state.activeTheme ?? 'industrial'
  );
  faceMat = createGhostMaterial(baseMat);
} else {
  // Fallback: use surface type from faces field
  const surfType = ghostPreset.faces[fc.face];
  faceMat = GLASS_SURFACES.has(surfType) ? _ghostMats.glass : _ghostMats.solid;
}

mesh.material = faceMat;
```

- [ ] **Step 3: Add pulse animation for material-accurate ghosts**

Track active ghost materials in a module-level array for opacity pulsing:

```typescript
const _activeGhostMats: THREE.Material[] = [];

// In the pulse useFrame (existing ~line 165):
useFrame(({ clock }) => {
  const t = (Math.sin(clock.getElapsedTime() * Math.PI * 2 / 0.8) + 1) / 2;
  _ghostMats.solid.opacity = 0.22 + t * 0.12;
  _ghostMats.glass.opacity = 0.14 + t * 0.10;
  // Also pulse material-accurate ghosts
  for (const mat of _activeGhostMats) {
    mat.opacity = 0.22 + t * 0.12;
  }
});
```

At the START of each positioning frame, clear the array with `_activeGhostMats.length = 0;` before pushing newly active materials. This prevents unbounded growth and stale material references.

- [ ] **Step 4: Add pop animation**

In the positioning `useFrame`, after the pool mesh assignment section:

```typescript
const { ghostPopActive, ghostPopStartTime } = state;
if (ghostPopActive) {
  const elapsed = performance.now() - ghostPopStartTime;
  const progress = Math.min(elapsed / 200, 1); // 200ms duration
  // Pop curve: 0→1.06→1.0 (peak at 40%)
  let scale: number;
  if (progress < 0.4) {
    scale = 1.0 + 0.06 * (progress / 0.4); // ramp up to 1.06
  } else {
    scale = 1.06 - 0.06 * ((progress - 0.4) / 0.6); // ease back to 1.0
  }
  for (let i = 0; i < poolIdx; i++) {
    pool[i].scale.setScalar(scale);
  }
  if (progress >= 1.0) {
    state.clearGhostPop();
    // Reset scales
    for (let i = 0; i < poolIdx; i++) {
      pool[i].scale.setScalar(1.0);
    }
  }
} else {
  // Ensure scales are reset when not popping
  for (let i = 0; i < poolIdx; i++) {
    pool[i].scale.setScalar(1.0);
  }
}
```

- [ ] **Step 5: Run full test suite + type check**

Run: `npx tsc --noEmit && npx vitest run -v`
Expected: 0 type errors, all tests pass.

- [ ] **Step 6: Browser verification**

Open app → select container → Block tab → hover "Floor" preset. The ghost overlay should now show actual wood texture (from `_themeMats`) on the bottom face at 30% opacity, pulsing gently. Previously it showed flat blue.

- [ ] **Step 7: Commit**

```bash
git add src/components/objects/HoverPreviewGhost.tsx
git commit -m "feat: PresetGhost with material-accurate clones + pop animation"
```

---

### Task 5: Integrate Material Map in All Tabs

**Files:**
- Modify: `src/components/ui/finishes/BlockTab.tsx`
- Modify: `src/components/ui/finishes/VariantGrid.tsx`
- Modify: `src/components/ui/finishes/FlooringTab.tsx`
- Modify: `src/components/ui/finishes/CeilingTab.tsx`

**Context:** Each tab needs to set `ghostPreset.materialMap` on hover so PresetGhost renders the correct materials. Currently only BlockTab calls `setGhostPreset` (with `faces` only, no `materialMap`).

- [ ] **Step 1: Update BlockTab hover handler**

In `src/components/ui/finishes/BlockTab.tsx`, update the `onMouseEnter` handler (~line 53):

```typescript
onMouseEnter={() => {
  // Build materialMap from preset faces
  const materialMap: Partial<Record<keyof VoxelFaces, MaterialDef>> = {};
  for (const [fk, st] of Object.entries(preset.faces) as [keyof VoxelFaces, SurfaceType][]) {
    if (st !== 'Open') {
      materialMap[fk] = { surfaceType: st };
    }
  }
  setGhostPreset({
    source: 'block',
    faces: preset.faces,
    targetScope: indices.length > 1 ? 'bay' : 'voxel',
    materialMap,
  });
}}
```

Add imports for `MaterialDef`, `VoxelFaces`, `SurfaceType` from `@/types/container`.

- [ ] **Step 2: Update VariantGrid hover handler**

In `src/components/ui/finishes/VariantGrid.tsx`:

1. Add a `ghostSource` prop to `VariantGridProps`:
```typescript
interface VariantGridProps {
  // ... existing props ...
  ghostSource: 'walls' | 'flooring' | 'ceiling'; // which tab is rendering this grid
}
```

2. Update `handleHover` (~line 64):
```typescript
const handleHover = (variant: CategoryVariant) => {
  if (category.volumetric) return;
  setActiveBrush(variant.surfaceType);
  if (indices.length > 0) {
    setStampPreview({
      surfaceType: variant.surfaceType,
      containerId,
      voxelIndex: indices[0],
    });
    // Set material-accurate ghost for the selected face
    const materialMap: Partial<Record<keyof VoxelFaces, MaterialDef>> = {
      [face]: { surfaceType: variant.surfaceType, finishMeta: variant.finishMeta },
    };
    setGhostPreset({
      source: ghostSource, // passed from parent tab
      faces: { ...currentFaces, [face]: variant.surfaceType },
      targetScope: indices.length > 1 ? 'bay' : 'voxel',
      materialMap,
    });
  }
};
```

3. Update all call sites to pass `ghostSource`:
   - `WallsTab.tsx`: `<VariantGrid ... ghostSource="walls" />`
   - `FlooringTab.tsx`: `<VariantGrid ... ghostSource="flooring" />`
   - `CeilingTab.tsx`: `<VariantGrid ... ghostSource="ceiling" />`
```

This requires reading the current voxel's faces. Add a selector:
```typescript
const currentFaces = useStore((s) => {
  const v = s.containers[containerId]?.voxelGrid?.[indices[0]];
  return v?.faces ?? { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' };
});
```

Also update `handleLeave` to clear the ghost:
```typescript
const handleLeave = () => {
  if (category.volumetric) return;
  setActiveBrush(null);
  useStore.getState().clearStampPreview();
  useStore.getState().clearGhostPreset();
};
```

Add `setGhostPreset` to the selectors and import `MaterialDef`, `VoxelFaces` from `@/types/container`.

- [ ] **Step 3: Update FlooringTab hover handler**

In `src/components/ui/finishes/FlooringTab.tsx`, find the texture/swatch card hover handlers. Add `onMouseEnter`/`onMouseLeave` to set ghostPreset with `materialMap.bottom`:

```typescript
// On hover of a flooring material card:
// Add currentFaces selector (same pattern as VariantGrid):
const currentFaces = useStore((s) => {
  const v = s.containers[containerId]?.voxelGrid?.[indices[0]];
  return v?.faces ?? { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' };
});

const handleFloorHover = (surfaceType: SurfaceType, textureId?: string) => {
  setGhostPreset({
    source: 'flooring',
    faces: { ...currentFaces, bottom: surfaceType },
    targetScope: indices.length > 1 ? 'bay' : 'voxel',
    materialMap: { bottom: { surfaceType, textureId } },
  });
};

const handleFloorLeave = () => {
  clearGhostPreset();
};
```

Wire these to the PresetCard/TextureSwatchGrid `onMouseEnter`/`onMouseLeave` props.

- [ ] **Step 4: Update CeilingTab hover handler**

Same pattern as FlooringTab but for `materialMap.top` and `source: 'ceiling'`. Add the same `currentFaces` selector as FlooringTab:

```typescript
const handleCeilHover = (surfaceType: SurfaceType, textureId?: string) => {
  setGhostPreset({
    source: 'ceiling',
    faces: { ...currentFaces, top: surfaceType },
    targetScope: indices.length > 1 ? 'bay' : 'voxel',
    materialMap: { top: { surfaceType, textureId } },
  });
};
```

- [ ] **Step 5: Type check + tests**

Run: `npx tsc --noEmit && npx vitest run -v`
Expected: 0 type errors, all tests pass.

- [ ] **Step 6: Browser verification**

Test each tab:
- Block tab → hover "Railing" → ghost shows glass railing material on n/s faces
- Walls tab → hover "Glass" variant → ghost shows glass material on selected face only
- Flooring tab → hover "Oak Planks" → ghost shows wood texture on floor face
- Ceiling tab → hover material → ghost shows on ceiling face

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/finishes/BlockTab.tsx \
  src/components/ui/finishes/VariantGrid.tsx \
  src/components/ui/finishes/FlooringTab.tsx \
  src/components/ui/finishes/CeilingTab.tsx
git commit -m "feat: material-accurate ghost preview across Block, Walls, Flooring, Ceiling tabs"
```

---

### Task 6: Build Block Thumbnail Renderer

**Files:**
- Create: `src/components/ui/finishes/BlockThumbnailContext.tsx`
- Create: `src/components/ui/finishes/BlockThumbnailRenderer.tsx`
- Modify: `src/components/ui/finishes/BlockTab.tsx` (consume thumbnails)

**Context:** Hidden R3F Canvas renders each block preset as a 128×128 thumbnail using real PBR materials. Thumbnails are cached as data URLs. The `useBlockThumbnail(presetId)` hook returns the cached URL. BlockTab replaces `IsometricVoxelSVG` with `<img src={thumbnail} />`.

- [ ] **Step 1: Create BlockThumbnailContext**

```typescript
// src/components/ui/finishes/BlockThumbnailContext.tsx
'use client';
import { createContext, useContext } from 'react';

type ThumbnailMap = Map<string, string>;

const BlockThumbnailCtx = createContext<ThumbnailMap>(new Map());

export function BlockThumbnailProvider({ children, thumbnails }: {
  children: React.ReactNode;
  thumbnails: ThumbnailMap;
}) {
  return (
    <BlockThumbnailCtx.Provider value={thumbnails}>
      {children}
    </BlockThumbnailCtx.Provider>
  );
}

/** Get cached data URL for a block preset thumbnail. Returns undefined if not yet rendered. */
export function useBlockThumbnail(presetId: string): string | undefined {
  const map = useContext(BlockThumbnailCtx);
  return map.get(presetId);
}
```

- [ ] **Step 2: Create BlockThumbnailRenderer**

```typescript
// src/components/ui/finishes/BlockThumbnailRenderer.tsx
'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_PRESETS } from '@/config/blockPresets';
import { getMaterialForFace, _themeMats } from '@/config/materialCache';
import { useStore } from '@/store/useStore';
import { CONTAINER_DIMENSIONS, ContainerSize } from '@/types/container';
import { BlockThumbnailProvider } from './BlockThumbnailContext';

const THUMB_SIZE = 128;
// Isometric camera angle matching VoxelPreview3D
const ISO_ANGLE = Math.PI / 6; // 30 degrees

function ThumbnailScene({ onCapture }: { onCapture: (id: string, url: string) => void }) {
  const { gl, scene, camera } = useThree();
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;

    const themeId = useStore.getState().activeTheme ?? 'industrial';
    const dims = CONTAINER_DIMENSIONS['20ft' as ContainerSize]; // reference dims
    const voxW = dims.length / 6;
    const voxD = dims.width / 2;
    const vH = dims.height / 2; // single level height

    for (const preset of BLOCK_PRESETS) {
      // Clear scene
      while (scene.children.length > 0) scene.remove(scene.children[0]);

      // Add lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(3, 4, 2);
      scene.add(ambient, dir);

      // Build voxel box — 6 faces
      const group = new THREE.Group();
      const faceKeys = ['top', 'bottom', 'n', 's', 'e', 'w'] as const;

      for (const fk of faceKeys) {
        const st = preset.faces[fk];
        if (st === 'Open') continue; // skip open faces

        // getMaterialForFace(surface, finish, theme) — 3 args
        const mat = getMaterialForFace(st, undefined, themeId);
        let plane: THREE.PlaneGeometry;
        const mesh = new THREE.Mesh();

        switch (fk) {
          case 'top':
          case 'bottom': {
            plane = new THREE.PlaneGeometry(voxW, voxD);
            mesh.geometry = plane;
            mesh.material = mat;
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.y = fk === 'top' ? vH / 2 : -vH / 2;
            break;
          }
          case 'n':
          case 's': {
            plane = new THREE.PlaneGeometry(voxW, vH);
            mesh.geometry = plane;
            mesh.material = mat;
            mesh.position.z = fk === 'n' ? -voxD / 2 : voxD / 2;
            if (fk === 's') mesh.rotation.y = Math.PI;
            break;
          }
          case 'e':
          case 'w': {
            plane = new THREE.PlaneGeometry(voxD, vH);
            mesh.geometry = plane;
            mesh.material = mat;
            mesh.position.x = fk === 'e' ? voxW / 2 : -voxW / 2;
            mesh.rotation.y = fk === 'e' ? Math.PI / 2 : -Math.PI / 2;
            break;
          }
        }
        group.add(mesh);
      }

      scene.add(group);

      // Render and capture
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL('image/png');
      onCapture(preset.id, url);

      // Dispose per-preset geometries to prevent memory leak
      group.traverse((child) => {
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
      });
    }
  }, [gl, scene, camera, onCapture]);

  return null;
}

export default function BlockThumbnailRenderer({ children }: { children: React.ReactNode }) {
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const activeTheme = useStore((s) => s.activeTheme);

  const handleCapture = useCallback((id: string, url: string) => {
    setThumbnails(prev => {
      const next = new Map(prev);
      next.set(id, url);
      return next;
    });
  }, []);

  // Re-render thumbnails when theme changes
  const key = activeTheme ?? 'industrial';

  return (
    <BlockThumbnailProvider thumbnails={thumbnails}>
      {children}
      {/* Hidden off-screen canvas for thumbnail capture */}
      <div style={{ position: 'absolute', left: -9999, top: -9999, width: THUMB_SIZE, height: THUMB_SIZE, overflow: 'hidden' }}>
        <Canvas
          key={key}
          frameloop="never"
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{
            position: [2.5, 2, 2.5],
            fov: 35,
            near: 0.1,
            far: 50,
          }}
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
        >
          <ThumbnailScene onCapture={handleCapture} />
        </Canvas>
      </div>
    </BlockThumbnailProvider>
  );
}
```

- [ ] **Step 3: Update BlockTab to use thumbnails**

In `src/components/ui/finishes/BlockTab.tsx`:

1. Import `useBlockThumbnail` from `./BlockThumbnailContext`
2. Replace the `icon` prop on PresetCard with `content`:

```typescript
// Inside the preset card render:
const thumbnail = useBlockThumbnail(preset.id);

<PresetCard
  key={preset.id}
  content={thumbnail ? (
    <img src={thumbnail} alt={preset.label}
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
  ) : (
    <IsometricVoxelSVG faces={preset.faces} />  // fallback during loading
  )}
  label={preset.label}
  active={isActive}
  onClick={() => handleSelect(preset)}
  onMouseEnter={() => handleHover(preset)}
  onMouseLeave={handleLeave}
/>
```

3. Wrap the BlockTab rendering tree with `<BlockThumbnailRenderer>` — this should go in `FinishesPanel.tsx` so the context is available when BlockTab mounts:

In `src/components/ui/finishes/FinishesPanel.tsx`, wrap the content with `BlockThumbnailRenderer`:
```typescript
import BlockThumbnailRenderer from './BlockThumbnailRenderer';

// In the return JSX:
<BlockThumbnailRenderer>
  {/* existing tab content */}
</BlockThumbnailRenderer>
```

- [ ] **Step 4: Type check + tests**

Run: `npx tsc --noEmit && npx vitest run -v`
Expected: 0 type errors, all tests pass.

- [ ] **Step 5: Browser verification**

Open app → select container → Block tab. Cards should show PBR-textured isometric voxel thumbnails instead of flat SVG line art. Each preset (Void, Floor, Ceiling, etc.) should have distinct material textures visible.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/finishes/BlockThumbnailContext.tsx \
  src/components/ui/finishes/BlockThumbnailRenderer.tsx \
  src/components/ui/finishes/BlockTab.tsx \
  src/components/ui/finishes/FinishesPanel.tsx
git commit -m "feat: R3F OffscreenCanvas block preset thumbnails with PBR materials"
```

---

### Task 7: Wire Pop-and-Shrink to Click Handlers

**Files:**
- Modify: `src/components/ui/finishes/BlockTab.tsx`
- Modify: `src/components/ui/finishes/VariantGrid.tsx`

**Context:** When a preset card is clicked, call `triggerGhostPop()` before applying the preset. The PresetGhost's useFrame (Task 4) already handles the 3D pop animation and calls `clearGhostPop()` after 200ms. The PresetCard already has `selectPop` keyframe on the card UI side.

- [ ] **Step 1: Update BlockTab click handler**

In `src/components/ui/finishes/BlockTab.tsx`, update the onClick:

```typescript
const triggerGhostPop = useStore((s) => s.triggerGhostPop);

// In onClick:
onClick={() => {
  triggerGhostPop(); // 3D pop animation
  applyBlockConfig(containerId, indices, preset.id);
}}
```

- [ ] **Step 2: Update VariantGrid click handler**

In `src/components/ui/finishes/VariantGrid.tsx`, update `handleSelect`:

```typescript
const triggerGhostPop = useStore((s) => s.triggerGhostPop);

const handleSelect = (variant: CategoryVariant) => {
  triggerGhostPop(); // 3D pop animation
  if (category.volumetric) {
    // ... existing stairs logic
  }
  // ... existing paintFace logic
};
```

- [ ] **Step 3: Type check + tests**

Run: `npx tsc --noEmit && npx vitest run -v`
Expected: All pass.

- [ ] **Step 4: Browser verification**

Select container → Block tab → hover a preset (ghost appears) → click it. Observe:
1. Card plays pop-and-shrink animation (existing `selectPop`)
2. Ghost panels in 3D briefly scale up then shrink as materials are applied
3. Ghost disappears, real materials shown at full opacity

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/finishes/BlockTab.tsx \
  src/components/ui/finishes/VariantGrid.tsx
git commit -m "feat: wire pop-and-shrink click confirmation to Block + Wall tabs"
```

---

### Task 8: Final Integration Test + Browser QA

**Files:**
- No new files

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run -v`
Expected: All tests pass.

- [ ] **Step 3: Comprehensive browser QA**

Test each flow end-to-end:

1. **Gull-Wing:** Select container → Block tab → click Gull-Wing → scene stays visible, gull-wing panels render
2. **Block thumbnails:** Block tab shows PBR-textured cards (steel, wood, glass textures visible), not flat SVGs
3. **Ghost preview - Block:** Hover "Floor" preset → bottom face shows wood texture at 30% opacity, pulsing
4. **Ghost preview - Walls:** Switch to Walls tab → select a wall type → hover variant → selected face shows material preview
5. **Ghost preview - Flooring:** Switch to Flooring tab → hover a material → floor face shows ghost
6. **Ghost preview - Ceiling:** Switch to Ceiling tab → hover a material → ceiling face shows ghost
7. **Pop animation:** Click any preset/variant → observe pop-and-shrink in 3D (scale 1→1.06→1) + card pop
8. **Theme change:** Switch theme (Industrial → Japanese) → block thumbnails re-render with new materials → ghost previews use new materials

- [ ] **Step 4: Run /simplify**

Invoke the simplify skill to catch code quality issues, dead code, and missed reuse.

- [ ] **Step 5: Final commit if simplify made changes**

```bash
git add -A
git commit -m "chore: simplify cleanup after block icons + ghost preview implementation"
```
